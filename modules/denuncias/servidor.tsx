import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, contacts } from "@/db/schema";
import type { ModuloServidor } from "@/lib/modules/types";
import type { ToolResult } from "@/lib/agent/tools";
import manifiesto from "./manifiesto";
import { sugerir } from "./lib/clasificador";
import { buscarDenuncia, catalogoProblemas, ErrorPortal, insertarDenuncia, portalConfigurado } from "./lib/portal";
import { centroCiudad, ciudad, ubicar } from "./lib/geocodificar";
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

async function registrar(args: Record<string, unknown>, ctx: { contactId: string; contactPhone: string | null }): Promise<ToolResult> {
  if (!portalConfigurado()) return sinPortal();
  const errores: string[] = [];

  const problemaId = Number(args.problema_id);
  const problema = (await catalogoProblemas()).find((p) => p.id === problemaId);
  if (!problema) errores.push("problema_id: no existe; usa clasificar_reclamo para obtenerlo");

  const direccion = texto(args.direccion, 255);
  if (!direccion) errores.push("direccion: falta la calle y altura (o esquina) del problema");
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
  let punto = await ubicar(direccion);
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

  try {
    const codigo = await insertarDenuncia({
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

    // La ficha del contacto queda al dia: nombre, DNI y el codigo para el seguimiento.
    await db
      .update(contacts)
      .set({
        customFields: sql`${contacts.customFields} || ${JSON.stringify({ dni, ultimo_reclamo: codigo })}::jsonb`,
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
        mensaje: `Reclamo registrado. Dale al vecino el codigo ${codigo} para seguirlo.`,
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
            "Registra el reclamo en el portal municipal y devuelve el codigo de seguimiento. Llamala SOLO cuando tengas: problema_id confirmado, direccion, DNI, nombre y apellido, y el vecino confirmo el resumen. El telefono por defecto es el del chat.",
          parameters: {
            type: "object",
            properties: {
              problema_id: { type: "integer", description: "De clasificar_reclamo, confirmado por el vecino." },
              descripcion: { type: "string", description: "Descripcion del problema." },
              direccion: { type: "string", description: "Calle y altura, o esquina, donde esta el problema." },
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
            required: ["problema_id", "direccion", "dni", "nombre", "apellido"],
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
