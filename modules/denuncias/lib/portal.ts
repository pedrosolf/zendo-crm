import "server-only";

/**
 * Acceso al portal de denuncias (Supabase propio del municipio) por su API REST.
 * El CRM no comparte base con el portal: escribe en la misma tabla `denuncias` que el
 * wizard web, asi que el reclamo aparece en el panel municipal con su codigo.
 *
 * Credenciales en el entorno (nunca en el codigo):
 *   DENUNCIAS_SUPABASE_URL, DENUNCIAS_SUPABASE_SERVICE_ROLE_KEY
 * Se usa la service role porque el codigo lo asigna un trigger y leerlo de vuelta solo
 * esta permitido al personal (RLS), igual que hace el wizard con su cliente admin.
 */

export function portalConfigurado(): boolean {
  return Boolean(process.env.DENUNCIAS_SUPABASE_URL && process.env.DENUNCIAS_SUPABASE_SERVICE_ROLE_KEY);
}

export class ErrorPortal extends Error {}

async function rest<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const url = process.env.DENUNCIAS_SUPABASE_URL;
  const clave = process.env.DENUNCIAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new ErrorPortal("El portal de denuncias no esta configurado (DENUNCIAS_SUPABASE_URL).");
  const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${ruta}`, {
    ...init,
    headers: {
      apikey: clave,
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => "");
    throw new ErrorPortal(`El portal respondio ${r.status}: ${detalle.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}

export interface ProblemaPortal {
  id: number;
  nombre: string;
  tipo_id: number;
  tipo_nombre: string;
  sinonimos: string[];
}

let catalogo: { datos: ProblemaPortal[]; vence: number } | null = null;

/** Problemas con su tipo y sinonimos. Cache de 10 minutos: la taxonomia casi no cambia. */
export async function catalogoProblemas(): Promise<ProblemaPortal[]> {
  if (catalogo && catalogo.vence > Date.now()) return catalogo.datos;
  type Fila = {
    id: number;
    nombre: string;
    tipo_id: number;
    tipos_problema: { nombre: string } | { nombre: string }[] | null;
    sinonimos: { termino: string }[] | null;
  };
  const filas = await rest<Fila[]>("problemas?select=id,nombre,tipo_id,tipos_problema(nombre),sinonimos(termino)");
  const datos = filas.map((p) => {
    const tipo = Array.isArray(p.tipos_problema) ? p.tipos_problema[0] : p.tipos_problema;
    return {
      id: p.id,
      nombre: p.nombre,
      tipo_id: p.tipo_id,
      tipo_nombre: tipo?.nombre ?? "",
      sinonimos: (p.sinonimos ?? []).map((s) => s.termino),
    };
  });
  catalogo = { datos, vence: Date.now() + 10 * 60_000 };
  return datos;
}

export interface NuevaDenuncia {
  tipo_id: number;
  problema_id: number;
  direccion: string;
  lat: number;
  lng: number;
  referencia: string | null;
  descripcion: string | null;
  denunciante_dni: string;
  denunciante_nombre: string;
  denunciante_apellido: string;
  denunciante_telefono: string;
  denunciante_email: string | null;
  /** Nombre del archivo en el bucket `fotos` del portal (como lo deja el wizard web). */
  foto_path?: string | null;
}

/** Lo mismo que acepta el wizard web: PNG, JPG o GIF de hasta 5 MB. */
const MIMES_FOTO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif" };
// El bucket `fotos` del portal tiene file_size_limit 5.000.000 (no 5 MiB).
export const MAX_BYTES_FOTO = 5_000_000;

export function fotoAceptada(mime: string, bytes: number): boolean {
  return Boolean(MIMES_FOTO[mime]) && bytes > 0 && bytes <= MAX_BYTES_FOTO;
}

/**
 * Sube la foto al bucket privado `fotos` del portal y devuelve el nombre para
 * `denuncias.foto_path`. El panel municipal la muestra con una URL firmada, igual que
 * las que sube el wizard (`<uuid>.<ext>` en la raiz del bucket).
 */
export async function subirFoto(bytes: Buffer, mime: string): Promise<string> {
  const url = process.env.DENUNCIAS_SUPABASE_URL;
  const clave = process.env.DENUNCIAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new ErrorPortal("El portal de denuncias no esta configurado.");
  const ext = MIMES_FOTO[mime];
  if (!ext || !fotoAceptada(mime, bytes.length)) throw new ErrorPortal(`Foto no aceptada (${mime}, ${bytes.length} bytes).`);
  const nombre = `${crypto.randomUUID()}.${ext}`;
  const r = await fetch(`${url.replace(/\/$/, "")}/storage/v1/object/fotos/${nombre}`, {
    method: "POST",
    headers: { apikey: clave, Authorization: `Bearer ${clave}`, "Content-Type": mime, "x-upsert": "false" },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new ErrorPortal(`El storage del portal respondio ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
  return nombre;
}

export async function insertarDenuncia(d: NuevaDenuncia): Promise<string> {
  const [fila] = await rest<{ codigo: string }[]>("denuncias?select=codigo", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(d),
  });
  if (!fila?.codigo) throw new ErrorPortal("El portal no devolvio el codigo del reclamo.");
  return fila.codigo;
}

export interface EstadoDenuncia {
  codigo: string;
  estado: string;
  direccion: string;
  created_at: string;
  updated_at: string;
  problema: string;
  tipo: string;
}

export async function buscarDenuncia(codigo: string): Promise<EstadoDenuncia | null> {
  const limpio = `#${codigo.replace(/[^0-9]/g, "")}`;
  type Fila = Omit<EstadoDenuncia, "problema" | "tipo"> & {
    problemas: { nombre: string } | null;
    tipos_problema: { nombre: string } | null;
  };
  const filas = await rest<Fila[]>(
    `denuncias?select=codigo,estado,direccion,created_at,updated_at,problemas(nombre),tipos_problema(nombre)&codigo=eq.${encodeURIComponent(limpio)}&limit=1`
  );
  const f = filas[0];
  if (!f) return null;
  return {
    codigo: f.codigo,
    estado: f.estado,
    direccion: f.direccion,
    created_at: f.created_at,
    updated_at: f.updated_at,
    problema: f.problemas?.nombre ?? "",
    tipo: f.tipos_problema?.nombre ?? "",
  };
}

/** Ultimos reclamos del portal, para la pagina del modulo. */
export async function ultimasDenuncias(limite = 30) {
  type Fila = {
    codigo: string;
    estado: string;
    direccion: string;
    created_at: string;
    denunciante_nombre: string;
    denunciante_apellido: string;
    problemas: { nombre: string } | null;
  };
  return rest<Fila[]>(
    `denuncias?select=codigo,estado,direccion,created_at,denunciante_nombre,denunciante_apellido,problemas(nombre)&order=created_at.desc&limit=${limite}`
  );
}
