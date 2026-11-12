import "server-only";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, contacts } from "@/db/schema";
import type { ModuloServidor } from "@/lib/modules/types";
import type { ToolContext, ToolResult } from "@/lib/agent/tools";
import { fotosRecibidas } from "@/lib/channels/fotos";
import { descargarMedio } from "@/lib/channels/transcribir";
import manifiesto from "./manifiesto";
import { sugerir } from "./lib/clasificador";
import { resolverProblema } from "./lib/resolver";
import { buscarDenuncia, catalogoProblemas, ErrorPortal, fotoAceptada, insertarDenuncia, portalConfigurado, subirFoto } from "./lib/portal";
import { centroCiudad, ciudad, dentroDeLaCiudad, direccionDe, ubicar } from "./lib/geocodificar";
import { ReclamosPage } from "./componentes/ReclamosPage";

/**
 * Tools del agente: el mismo recorrido que el wizard web de denuncias-next, en chat.
 *   1. clasificar_reclamo  -> con la descripcion, sugiere tipo y problema (mismo algoritmo)
 *   2. registrar_reclamo   -> valida como el wizard, ubica la direccion y crea la denuncia
 *   3. consultar_reclamo   -> estado de un reclamo por su codigo
 */

const ESTADOS: Record<string, string> = {
  recibido: "Recibido",
  en_curso: "En curso",
  finalizado: "Finalizado",
  pospuesto: "Pospuesto",
  rechazado: "Rechazado",
};

function sinPortal(): ToolResult {
  return { ok: false, error: "El portal de denuncias no esta conectado. Deriva a una persona del equipo." };
}

function texto(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

async function clasificar(args: Record<string, unknown>): Promise<ToolResult> {
  if (!portalConfigurado()) return sinPortal();
  const descripcion = texto(args.descripcion, 1000);
  if (descripcion.length < 3) return { ok: false, error: "Pedi al vecino que cuente un poco mas que paso." };
  const catalogo = await catalogoProblemas();
  const sugerencias = sugerir(descripcion, catalogo).slice(0, 5);
  // El clasificador del portal es por palabras: sin sinonimos cargados falla con frases
  // comunes ("no anda la luz"). Por eso siempre van los tipos, para que el agente pueda
  // elegir uno y ver sus problemas con listar_problemas.
  const tipos = [...new Map(catalogo.map((p) => [p.tipo_id, p.tipo_nombre])).values()];
  return {
    ok: true,
    data: {
      sugerencias: sugerencias.map((s) => ({ problema_id: s.problema_id, problema: s.problema, tipo: s.tipo })),
      tipos,
      mensaje:
        sugerencias.length > 0
          ? "Si alguna sugerencia corresponde claramente, confirmala con el vecino. Si ninguna encaja con lo que conto, elegi el tipo que corresponda y llama a listar_problemas."
          : "Sin coincidencias por palabras. Elegi el tipo que corresponda a lo que conto el vecino y llama a listar_problemas.",
    },
  };
}

async function listarProblemas(args: Record<string, unknown>): Promise<ToolResult> {
  if (!portalConfigurado()) return sinPortal();
  const q = texto(args.tipo, 100).toLowerCase();
  const catalogo = await catalogoProblemas();
  const delTipo = catalogo.filter((p) => p.tipo_nombre.toLowerCase().includes(q) || String(p.tipo_id) === q);
  if (!q || delTipo.length === 0) {
    return { ok: false, error: `Tipo no encontrado. Tipos: ${[...new Set(catalogo.map((p) => p.tipo_nombre))].join(", ")}` };
  }
  return {
    ok: true,
    data: {
      tipo: delTipo[0].tipo_nombre,
      problemas: delTipo.map((p) => ({ problema_id: p.id, problema: p.nombre })),
    },
  };
}

/**
 * La foto que mando el vecino por WhatsApp para ESTE reclamo: la ultima de las ultimas
 * 24 h que llego despues del reclamo anterior del mismo contacto (si no, un segundo
 * reclamo se llevaria la foto del primero). El portal guarda una sola foto por denuncia.
 * Si algo falla, el reclamo se registra igual sin foto: la foto es opcional en la web.
 */
async function fotoParaElReclamo(ctx: ToolContext): Promise<{ path: string | null; aviso?: string }> {
  if (!ctx.conversationId) return { path: null };
  const [anterior] = await db
    .select({ en: activities.createdAt })
    .from(activities)
    .where(and(eq(activities.contactId, ctx.contactId), ilike(activities.description, "Agente IA registro el reclamo%")))
    .orderBy(desc(activities.createdAt))
    .limit(1);
  const hace24h = new Date(Date.now() - 86_400_000);
  const desde = anterior && anterior.en > hace24h ? anterior.en : hace24h;
  const [foto] = await fotosRecibidas(ctx.conversationId, desde);
  if (!foto) return { path: null };
  const medio = await descargarMedio(foto.url);
  if (!medio) return { path: null, aviso: "No se pudo bajar la foto de WhatsApp: el reclamo quedo sin foto." };
  if (!fotoAceptada(medio.mime, medio.bytes.length)) {
    return { path: null, aviso: "La foto no es JPG/PNG/GIF o pesa mas de 5 MB: el reclamo quedo sin foto." };
  }
  try {
    return { path: await subirFoto(medio.bytes, medio.mime) };
  } catch (err) {
    console.error("[denuncias] no se pudo subir la foto:", err instanceof Error ? err.message : err);
    return { path: null, aviso: "No se pudo subir la foto al portal: el reclamo quedo sin foto." };
  }
}

async function registrar(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  if (!portalConfigurado()) return sinPortal();
  const errores: string[] = [];

  // Por nombre, no por id: ver resolverProblema.
  const resuelto = resolverProblema(await catalogoProblemas(), args);
  const problema = "problema" in resuelto ? resuelto.problema : undefined;
  if ("error" in resuelto) errores.push(resuelto.error);

  // Pin del mapa por WhatsApp: manda sobre la direccion escrita (Nominatim no siempre
  // encuentra calles de barrio, y el pin es exactamente donde esta el problema).
  const lat = Number(args.lat);
  const lng = Number(args.lng);
  const pin = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
  if (pin && !dentroDeLaCiudad(pin)) errores.push(`ubicacion: el punto compartido queda fuera de ${ciudad()}; pedi que la comparta de nuevo o que escriba la direccion`);
  let direccion = texto(args.direccion, 255);
  if (!direccion && pin && dentroDeLaCiudad(pin)) direccion = ((await direccionDe(pin)) ?? `Ubicacion ${lat.toFixed(5)},${lng.toFixed(5)}`).slice(0, 255);
  if (!direccion) errores.push("direccion: falta la calle y altura (o esquina) del problema, o que comparta la ubicacion");
  const dni = String(args.dni ?? "").replace(/[^0-9]/g, "");
  if (!/^[0-9]{7,9}$/.test(dni)) errores.push("dni: tiene que tener 7 a 9 numeros");
  const nombre = texto(args.nombre, 100);
  if (!nombre) errores.push("nombre: falta el nombre del vecino");
  const apellido = texto(args.apellido, 100);
  if (!apellido) errores.push("apellido: falta el apellido del vecino");
  const telefono = texto(args.telefono || ctx.contactPhone, 20);
  if (!/^[0-9+\s()-]{6,20}$/.test(telefono)) errores.push("telefono: falta un telefono de contacto valido");
  const email = texto(args.email, 150);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push("email: no es valido (es opcional, se puede omitir)");
  if (errores.length > 0) return { ok: false, error: `Faltan o no son validos estos datos: ${errores.join("; ")}` };

  let referencia = texto(args.referencia, 255) || null;
  let punto = pin ? { ...pin, encontrada: direccion, aproximada: false } : await ubicar(direccion);
  if (punto?.aproximada) {
    referencia = `Esquina/entre calles: ${direccion} (punto aproximado)${referencia ? `. ${referencia}` : ""}`.slice(0, 255);
  }
  if (!punto) {
    if (args.ubicacion_aproximada !== true) {
      return {
        ok: false,
        error: `No encontre "${direccion}" en ${ciudad()}. Pedi una esquina, la altura exacta o un lugar de referencia y volve a intentar. Si el vecino no puede precisarla, reintenta con ubicacion_aproximada=true.`,
      };
    }
    punto = { ...centroCiudad(), encontrada: "", aproximada: true };
    referencia = `Ubicacion aproximada (cargado por WhatsApp)${referencia ? `. ${referencia}` : ""}`.slice(0, 255);
  }

  const foto = await fotoParaElReclamo(ctx);

  try {
    const codigo = await insertarDenuncia({
      foto_path: foto.path,
      tipo_id: problema!.tipo_id,
      problema_id: problema!.id,
      direccion,
      lat: punto.lat,
      lng: punto.lng,
      referencia,
      descripcion: texto(args.descripcion, 2000) || null,
      denunciante_dni: dni,
      denunciante_nombre: nombre,
      denunciante_apellido: apellido,
      denunciante_telefono: telefono,
      denunciante_email: email || null,
    });

    // La ficha del contacto queda al dia: DNI, el codigo para el seguimiento y el nombre
    // real si el de WhatsApp no lo es ("." , ":/", un numero). Un nombre con letras se
    // respeta: puede haberlo cargado una persona del equipo.
    await db
      .update(contacts)
      .set({
        customFields: sql`${contacts.customFields} || ${JSON.stringify({ dni, ultimo_reclamo: codigo })}::jsonb`,
        name: sql`case when ${contacts.name} ~ '[[:alpha:]]{2,}' then ${contacts.name} else ${`${nombre} ${apellido}`} end`,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, ctx.contactId));
    await db.insert(activities).values({
      type: "note",
      description: `Agente IA registro el reclamo ${codigo}: ${problema!.nombre} en ${direccion}`,
      contactId: ctx.contactId,
    });

    return {
      ok: true,
      data: {
        codigo,
        problema: problema!.nombre,
        tipo: problema!.tipo_nombre,
        direccion,
        ubicacion: punto.encontrada || "aproximada",
        foto: foto.path ? "adjunta" : "sin foto",
        aviso_foto: foto.aviso,
        mensaje: `Reclamo registrado. Dale al vecino el codigo ${codigo} para seguirlo.${foto.path ? " Contale que la foto quedo adjunta." : ""}`,
      },
    };
  } catch (err) {
    const msg = err instanceof ErrorPortal ? err.message : "error inesperado";
    console.error("[denuncias] no se pudo registrar:", msg);
    return { ok: false, error: "No se pudo registrar el reclamo en el portal. Avisale al vecino y deriva a una persona." };
  }
}

async function consultar(args: Record<string, unknown>): Promise<ToolResult> {
  if (!portalConfigurado()) return sinPortal();
  const codigo = String(args.codigo ?? "");
  if (!/[0-9]{3,}/.test(codigo)) return { ok: false, error: "Pedi el codigo del reclamo (por ejemplo #1009)." };
  const d = await buscarDenuncia(codigo);
  if (!d) return { ok: true, data: { encontrado: false, mensaje: "No hay ningun reclamo con ese codigo." } };
  // Sin datos personales: con el codigo alcanza para saber el estado, no para ver quien reclamo.
  return {
    ok: true,
    data: {
      encontrado: true,
      codigo: d.codigo,
      estado: ESTADOS[d.estado] ?? d.estado,
      problema: d.problema,
      tipo: d.tipo,
      direccion: d.direccion,
      creado: d.created_at,
      actualizado: d.updated_at,
    },
  };
}

const servidor: ModuloServidor = {
  manifiesto,
  paginas: { "": ReclamosPage },
  tools: [
    {
      definicion: {
        type: "function",
        function: {
          name: "clasificar_reclamo",
          description:
            "Paso 1 de un reclamo municipal. Con la descripcion del problema que dio el vecino, devuelve las categorias posibles (problema_id, problema, tipo). Usala apenas el vecino cuenta que pasa.",
          parameters: {
            type: "object",
            properties: {
              descripcion: { type: "string", description: "Lo que conto el vecino, con sus palabras." },
            },
            required: ["descripcion"],
            additionalProperties: false,
          },
        },
      },
      descripcionUI: "Sugiere la categoria del reclamo con el mismo clasificador del portal de denuncias (modulo denuncias).",
      ejecutar: (args) => clasificar(args),
    },
    {
      definicion: {
        type: "function",
        function: {
          name: "listar_problemas",
          description:
            "Lista los problemas de un tipo de reclamo (ej. 'Alumbrado', 'Animales', 'Higiene') con su problema_id. Usala cuando las sugerencias de clasificar_reclamo no encajan.",
          parameters: {
            type: "object",
            properties: { tipo: { type: "string", description: "Nombre (o parte) del tipo, de la lista que devuelve clasificar_reclamo." } },
            required: ["tipo"],
            additionalProperties: false,
          },
        },
      },
      descripcionUI: "Lista los problemas de un tipo de reclamo del portal, para elegir la categoria exacta (modulo denuncias).",
      ejecutar: (args) => listarProblemas(args),
    },
    {
      definicion: {
        type: "function",
        function: {
          name: "registrar_reclamo",
          description:
            "Registra el reclamo en el portal municipal y devuelve el codigo de seguimiento. Llamala SOLO cuando tengas: la categoria confirmada, direccion (o el pin de ubicacion compartido), DNI, nombre y apellido, y el vecino confirmo el resumen. El telefono por defecto es el del chat.",
          parameters: {
            type: "object",
            properties: {
              problema: {
                type: "string",
                description: "Nombre EXACTO de la categoria que confirmo el vecino, tal como lo devolvio clasificar_reclamo o listar_problemas (ej. 'Bacheo urbano').",
              },
              problema_id: { type: "integer", description: "Opcional. Si no coincide con el nombre, se usa el nombre." },
              descripcion: { type: "string", description: "Descripcion del problema." },
              direccion: {
                type: "string",
                description: "Calle y altura, o esquina, donde esta el problema. Puede ir vacia si el vecino compartio la ubicacion (lat/lng).",
              },
              lat: { type: "number", description: "Latitud del pin si el vecino compartio la ubicacion (mensaje '📍 Ubicacion compartida: lat,lng')." },
              lng: { type: "number", description: "Longitud del pin compartido." },
              referencia: { type: "string", description: "Referencia opcional (frente a la escuela, al lado del kiosco)." },
              dni: { type: "string", description: "DNI del vecino, solo numeros." },
              nombre: { type: "string" },
              apellido: { type: "string" },
              telefono: { type: "string", description: "Opcional: si no, el del chat." },
              email: { type: "string", description: "Opcional." },
              ubicacion_aproximada: {
                type: "boolean",
                description: "true solo si la direccion no se encontro y el vecino no puede precisarla.",
              },
            },
            required: ["problema", "dni", "nombre", "apellido"],
            additionalProperties: false,
          },
        },
      },
      descripcionUI: "Registra el reclamo en el portal de denuncias y le da al vecino su codigo (modulo denuncias).",
      ejecutar: (args, ctx) => registrar(args, ctx),
    },
    {
      definicion: {
        type: "function",
        function: {
          name: "consultar_reclamo",
          description: "Consulta el estado de un reclamo por su codigo de seguimiento (ej. #1009).",
          parameters: {
            type: "object",
            properties: { codigo: { type: "string" } },
            required: ["codigo"],
            additionalProperties: false,
          },
        },
      },
      descripcionUI: "Informa el estado de un reclamo por su codigo (modulo denuncias).",
      ejecutar: (args) => consultar(args),
    },
  ],
};

export default servidor;
