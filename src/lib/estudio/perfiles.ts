import "server-only";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { esquemaConfig, type ConfigCliente, type ConfigClienteEntrada } from "@/lib/config/schema";
import { getConfig, erroresConfig } from "@/lib/config";
import {
  ASSETS_MARCA,
  type AssetMarca,
  esPng,
  generarClienteTs,
  MAX_BYTES_MARCA,
  perfilActivoDesde,
  rutaPublicaAsset,
  slugValido,
} from "./archivos";
import type { ModuloDisponible, PerfilResumen, EstadoEstudio, ResultadoAplicar } from "./tipos";
import { plantillas } from "@config/plantillas";

/**
 * Perfiles del Estudio en disco. Un perfil es config/perfiles/<slug>/config.json mas
 * public/marca/<slug>/{logo,icono}.png; config/cliente.ts importa el activo.
 * Ver specs/nucleo/12-estudio.md.
 *
 * Toda ruta se arma con un slug que paso por `slugValido` (FR-005): no hay forma de
 * escribir fuera de config/perfiles/ y public/marca/.
 */

const raiz = () => process.cwd();
const ejecutar = promisify(execFile);

export class ErrorEstudio extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly errores: string[] = []
  ) {
    super(message);
  }
}

function exigirSlug(slug: unknown): string {
  if (!slugValido(slug)) {
    throw new ErrorEstudio("Identificador invalido: minusculas, numeros y guiones (max 40).");
  }
  return slug;
}

const carpetaPerfiles = () => join(raiz(), "config", "perfiles");
const archivoPerfil = (slug: string) => join(carpetaPerfiles(), slug, "config.json");
const carpetaMarca = (slug: string) => join(raiz(), "public", "marca", slug);
const archivoCliente = () => join(raiz(), "config", "cliente.ts");
const archivoModulos = () => join(raiz(), "config", "modulos.json");

/** Errores de esquema en el formato `campo.sub: mensaje`. */
function validar(entrada: unknown): { config: ConfigCliente; errores: [] } | { config: null; errores: string[] } {
  const r = esquemaConfig.safeParse(entrada);
  if (!r.success) {
    return { config: null, errores: r.error.issues.map((i) => `${i.path.join(".") || "config"}: ${i.message}`) };
  }
  const disponibles = new Set(modulosDisponibles().map((m) => m.nombre));
  const faltan = r.data.modulos.activos.filter((m) => !disponibles.has(m));
  if (faltan.length > 0) {
    return { config: null, errores: faltan.map((m) => `modulos.activos: no existe modules/${m}`) };
  }
  return { config: r.data, errores: [] };
}

export function perfilActivo(): string | null {
  if (!existsSync(archivoCliente())) return null;
  return perfilActivoDesde(readFileSync(archivoCliente(), "utf8"));
}

export function leerPerfil(slugEntrada: unknown): ConfigClienteEntrada {
  const slug = exigirSlug(slugEntrada);
  if (!existsSync(archivoPerfil(slug))) throw new ErrorEstudio("No existe ese perfil.", 404);
  return JSON.parse(readFileSync(archivoPerfil(slug), "utf8"));
}

export function listarPerfiles(): PerfilResumen[] {
  if (!existsSync(carpetaPerfiles())) return [];
  const activo = perfilActivo();
  return readdirSync(carpetaPerfiles(), { withFileTypes: true })
    .filter((d) => d.isDirectory() && slugValido(d.name) && existsSync(archivoPerfil(d.name)))
    .map((d) => {
      const slug = d.name;
      let datos: Partial<ConfigClienteEntrada> = {};
      let errores: string[] = [];
      try {
        datos = JSON.parse(readFileSync(archivoPerfil(slug), "utf8"));
        errores = validar(datos).errores;
      } catch {
        errores = ["config.json no es JSON valido"];
      }
      return {
        slug,
        nombre: datos.marca?.nombre ?? slug,
        descripcion: datos.marca?.descripcion ?? "",
        colorPrimario: datos.marca?.colorPrimario ?? "#2E4A47",
        colorSidebar: datos.marca?.colorSidebar ?? "#0F1419",
        icono: datos.marca?.icono ?? null,
        activo: slug === activo,
        errores,
      };
    })
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre));
}

/** Carpetas de modules/ (sin las que empiezan con _), con titulo y descripcion. */
export function modulosDisponibles(): ModuloDisponible[] {
  const carpeta = join(raiz(), "modules");
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[a-z][a-z0-9_]*$/.test(d.name))
    .flatMap((d) => {
      const base = join(carpeta, d.name);
      const manifiesto = ["manifiesto.ts", "manifiesto.tsx"].map((f) => join(base, f)).find(existsSync);
      const servidor = ["servidor.ts", "servidor.tsx"].some((f) => existsSync(join(base, f)));
      if (!manifiesto || !servidor) return [];
      // El manifiesto es TypeScript con iconos importados: se leen los textos sin evaluarlo.
      const texto = readFileSync(manifiesto, "utf8");
      const campo = (k: string) => texto.match(new RegExp(`${k}:\\s*["'\`]([^"'\`]+)["'\`]`))?.[1];
      return [{ nombre: d.name, titulo: campo("titulo") ?? d.name, descripcion: campo("descripcion") ?? "" }];
    });
}

export function estadoEstudio(): EstadoEstudio {
  const clienteTs = existsSync(archivoCliente()) ? readFileSync(archivoCliente(), "utf8") : "";
  const activo = perfilActivoDesde(clienteTs);
  return {
    perfiles: listarPerfiles(),
    activo,
    clienteManual: !activo,
    erroresConfigCargada: erroresConfig(),
    plantillas: plantillas.map(({ clave, titulo, descripcion }) => ({ clave, titulo, descripcion })),
    modulos: modulosDisponibles(),
  };
}

function escribirJson(ruta: string, datos: unknown) {
  writeFileSync(ruta, JSON.stringify(datos, null, 2) + "\n", "utf8");
}

function copiarAssets(desde: string | null, slug: string) {
  mkdirSync(carpetaMarca(slug), { recursive: true });
  for (const asset of ASSETS_MARCA) {
    const origen = desde
      ? join(carpetaMarca(desde), `${asset}.png`)
      : join(raiz(), "public", "marca", `${asset}.png`);
    if (existsSync(origen)) copyFileSync(origen, join(carpetaMarca(slug), `${asset}.png`));
  }
}

/** Config de un perfil vacio: lo minimo que pasa el esquema, con pipeline generico. */
function configVacia(): ConfigClienteEntrada {
  return {
    marca: { nombre: "Nuevo cliente", nombreCorto: "Cliente" },
    idioma: "es",
    moneda: "USD",
    zonaHoraria: "America/Santiago",
    pipeline: {
      nombre: "Ventas",
      etapas: [
        { clave: "nuevo", nombre: "Nuevo lead", color: "#64748b" },
        { clave: "calificado", nombre: "Calificado", color: "#2563eb" },
        { clave: "propuesta", nombre: "Propuesta", color: "#f59e0b" },
        { clave: "ganado", nombre: "Cerrado ganado", color: "#16a34a", ganada: true },
        { clave: "perdido", nombre: "Cerrado perdido", color: "#dc2626", perdida: true },
      ],
    },
    contacto: { campos: [] },
    agente: { nombre: "Asistente" },
    modulos: { activos: [] },
  };
}

export type OrigenPerfil =
  | { tipo: "vacio" }
  | { tipo: "plantilla"; clave: string }
  | { tipo: "perfil"; slug: string };

export function crearPerfil(entrada: { nombre: string; slug: unknown; desde: OrigenPerfil }): string {
  const slug = exigirSlug(entrada.slug);
  const nombre = entrada.nombre.trim();
  if (!nombre) throw new ErrorEstudio("El perfil necesita un nombre.");
  if (existsSync(join(carpetaPerfiles(), slug))) throw new ErrorEstudio(`Ya existe un perfil "${slug}".`, 409);

  let base: ConfigClienteEntrada;
  let assetsDe: string | null = null;
  if (entrada.desde.tipo === "plantilla") {
    const clave = entrada.desde.clave;
    const p = plantillas.find((x) => x.clave === clave);
    if (!p) throw new ErrorEstudio("No existe esa plantilla.", 404);
    base = structuredClone(p.config);
  } else if (entrada.desde.tipo === "perfil") {
    assetsDe = exigirSlug(entrada.desde.slug);
    base = structuredClone(leerPerfil(assetsDe));
  } else {
    base = configVacia();
  }

  const config: ConfigClienteEntrada = {
    ...base,
    marca: {
      ...base.marca,
      nombre: nombre.slice(0, 60),
      nombreCorto: nombre.slice(0, 12).trim(),
      logo: rutaPublicaAsset(slug, "logo"),
      icono: rutaPublicaAsset(slug, "icono"),
    },
  };
  const { errores } = validar(config);
  if (errores.length > 0) throw new ErrorEstudio("La configuracion de origen no es valida.", 400, errores);

  mkdirSync(join(carpetaPerfiles(), slug), { recursive: true });
  escribirJson(archivoPerfil(slug), config);
  copiarAssets(assetsDe, slug);
  return slug;
}

/**
 * Pasa a la instancia la config del perfil activo: modulos.json, registro de modulos,
 * pipeline en la base e iconos de la PWA (FR-007). No depende de que el bundler ya haya
 * recargado config/cliente.ts.
 */
async function aplicar(slug: string, config: ConfigCliente): Promise<ResultadoAplicar> {
  const avisos: string[] = [];
  const antes: string[] = existsSync(archivoModulos())
    ? (JSON.parse(readFileSync(archivoModulos(), "utf8")).activos ?? [])
    : [];
  const ahora = config.modulos.activos;
  const modulosCambiaron = antes.length !== ahora.length || antes.some((m) => !ahora.includes(m));
  if (modulosCambiaron) {
    escribirJson(archivoModulos(), { activos: ahora });
    try {
      await ejecutar(process.execPath, ["scripts/generar-registro-modulos.mjs"], { cwd: raiz() });
    } catch (err) {
      avisos.push(`No se pudo regenerar el registro de modulos: ${err instanceof Error ? err.message : err}`);
    }
  }

  let pipeline: ResultadoAplicar["pipeline"] = null;
  try {
    const { sincronizarPipeline } = await import("@/lib/pipeline/sincronizar");
    // Al cambiar de perfil se van las etapas vacias del perfil anterior (FR-013); las que
    // tienen operaciones y las creadas a mano desde la UI se quedan.
    pipeline = await sincronizarPipeline({ pipeline: config.pipeline, borrarSobrantes: "con-clave" });
  } catch (err) {
    avisos.push(`No se pudo sincronizar el pipeline: ${err instanceof Error ? err.message : err}`);
  }

  const icono = join(carpetaMarca(slug), "icono.png");
  if (existsSync(icono)) {
    try {
      await ejecutar(
        process.execPath,
        ["scripts/pwa-icons.mjs", "--src", icono, "--bg", config.marca.colorSidebar],
        { cwd: raiz() }
      );
    } catch (err) {
      avisos.push(`No se pudieron regenerar los iconos de la PWA: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { modulosCambiaron, pipeline, avisos };
}

export async function guardarPerfil(slugEntrada: unknown, entrada: unknown): Promise<ResultadoAplicar | null> {
  const slug = exigirSlug(slugEntrada);
  if (!existsSync(archivoPerfil(slug))) throw new ErrorEstudio("No existe ese perfil.", 404);
  const { config, errores } = validar(entrada);
  if (!config) throw new ErrorEstudio("La configuracion tiene errores.", 400, errores);
  escribirJson(archivoPerfil(slug), config);
  return slug === perfilActivo() ? aplicar(slug, config) : null;
}

export async function activarPerfil(slugEntrada: unknown): Promise<ResultadoAplicar> {
  const slug = exigirSlug(slugEntrada);
  const { config, errores } = validar(leerPerfil(slug));
  if (!config) throw new ErrorEstudio("El perfil tiene errores: corregilos antes de activarlo.", 400, errores);
  // Primero modulos.json y el registro, despues cliente.ts: asi el bundler recarga una
  // sola vez con todo coherente.
  const resultado = await aplicar(slug, config);
  writeFileSync(archivoCliente(), generarClienteTs(slug), "utf8");
  return resultado;
}

export function borrarPerfil(slugEntrada: unknown) {
  const slug = exigirSlug(slugEntrada);
  if (slug === perfilActivo()) throw new ErrorEstudio("No se puede borrar el perfil activo.", 409);
  if (!existsSync(join(carpetaPerfiles(), slug))) throw new ErrorEstudio("No existe ese perfil.", 404);
  rmSync(join(carpetaPerfiles(), slug), { recursive: true, force: true });
  rmSync(carpetaMarca(slug), { recursive: true, force: true });
}

export async function guardarAsset(slugEntrada: unknown, asset: unknown, bytes: Uint8Array) {
  const slug = exigirSlug(slugEntrada);
  if (!ASSETS_MARCA.includes(asset as AssetMarca)) throw new ErrorEstudio("Asset invalido (logo o icono).");
  if (!existsSync(archivoPerfil(slug))) throw new ErrorEstudio("No existe ese perfil.", 404);
  if (bytes.length > MAX_BYTES_MARCA) throw new ErrorEstudio("La imagen pesa mas de 2 MB.");
  if (!esPng(bytes)) throw new ErrorEstudio("La imagen tiene que ser PNG.");
  mkdirSync(carpetaMarca(slug), { recursive: true });
  writeFileSync(join(carpetaMarca(slug), `${asset}.png`), bytes);

  // La config apunta al archivo del perfil (puede venir de una plantilla con otra ruta).
  const config = leerPerfil(slug);
  const ruta = rutaPublicaAsset(slug, asset as AssetMarca);
  const clave = asset as AssetMarca;
  if (config.marca[clave] !== ruta) {
    config.marca = { ...config.marca, [clave]: ruta };
    escribirJson(archivoPerfil(slug), config);
  }
  if (clave === "icono" && slug === perfilActivo()) {
    const { config: valida } = validar(config);
    if (valida) await aplicar(slug, valida);
  }
  return ruta;
}

/**
 * config/cliente.ts escrito a mano -> perfil nuevo con la config ya cargada (validada) y
 * activarlo (FR-002). Los assets se copian de donde apunte la marca.
 */
export async function importarConfigActual(slugEntrada: unknown): Promise<string> {
  const slug = exigirSlug(slugEntrada);
  if (perfilActivo()) throw new ErrorEstudio("config/cliente.ts ya carga un perfil.", 409);
  if (existsSync(join(carpetaPerfiles(), slug))) throw new ErrorEstudio(`Ya existe un perfil "${slug}".`, 409);
  const actual = structuredClone(getConfig());
  mkdirSync(carpetaMarca(slug), { recursive: true });
  for (const asset of ASSETS_MARCA) {
    const origen = join(raiz(), "public", actual.marca[asset].replace(/^\//, ""));
    if (existsSync(origen)) copyFileSync(origen, join(carpetaMarca(slug), `${asset}.png`));
    actual.marca[asset] = rutaPublicaAsset(slug, asset);
  }
  mkdirSync(join(carpetaPerfiles(), slug), { recursive: true });
  escribirJson(archivoPerfil(slug), actual);
  await activarPerfil(slug);
  return slug;
}
