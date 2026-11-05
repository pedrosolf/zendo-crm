import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { conocimientoDocumentos, conocimientoFragmentos } from "@/db/schema";
import { fragmentar, puntuar, type MimeConocimiento } from "./puro";
import { modeloEmbedding, vectorizar } from "./embeddings";

/**
 * Base de conocimiento del agente. Ver specs/nucleo/13-base-de-conocimiento.md.
 *
 *   crearDocumento -> fila "procesando" (la ruta responde)
 *   procesarDocumento (en after()) -> texto -> fragmentos -> embeddings -> "listo"
 *   buscarConocimiento -> coseno + palabras sobre los fragmentos de documentos listos
 */

export async function extraerTexto(bytes: Uint8Array, mime: MimeConocimiento): Promise<string> {
  if (mime !== "application/pdf") return new TextDecoder("utf-8").decode(bytes);
  // Import dinamico: pdf.js pesa y solo hace falta al procesar un PDF.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.join("\n\n");
}

export async function crearDocumento(datos: { nombre: string; mime: MimeConocimiento; tamano: number; subidoPor: string | null }) {
  const [doc] = await db
    .insert(conocimientoDocumentos)
    .values({ nombre: datos.nombre.slice(0, 200), mime: datos.mime, tamano: datos.tamano, subidoPor: datos.subidoPor })
    .returning({ id: conocimientoDocumentos.id });
  return doc.id;
}

async function marcarError(id: string, error: string) {
  await db
    .update(conocimientoDocumentos)
    .set({ estado: "error", error, updatedAt: new Date() })
    .where(eq(conocimientoDocumentos.id, id));
}

export async function procesarDocumento(id: string, bytes: Uint8Array, mime: MimeConocimiento) {
  try {
    const texto = await extraerTexto(bytes, mime);
    const fragmentos = fragmentar(texto);
    if (fragmentos.length === 0) {
      return marcarError(id, "El documento no tiene texto (si es un PDF escaneado, hace falta pasarlo por OCR).");
    }
    const modelo = modeloEmbedding();
    const vectores = await vectorizar(fragmentos, modelo);
    const conVector = vectores.filter(Boolean).length;
    for (let i = 0; i < fragmentos.length; i += 100) {
      await db.insert(conocimientoFragmentos).values(
        fragmentos.slice(i, i + 100).map((contenido, j) => ({
          documentoId: id,
          orden: i + j,
          contenido,
          embedding: vectores[i + j],
        }))
      );
    }
    await db
      .update(conocimientoDocumentos)
      .set({
        estado: "listo",
        fragmentos: fragmentos.length,
        modeloEmbedding: conVector > 0 ? modelo : null,
        // Sin vectores igual sirve (busqueda por palabras), pero se avisa.
        error: conVector < fragmentos.length ? `${fragmentos.length - conVector} fragmentos sin vector: se buscan por palabras` : null,
        updatedAt: new Date(),
      })
      .where(eq(conocimientoDocumentos.id, id));
    cache = null;
  } catch (err) {
    console.error("[conocimiento] procesando", id, err);
    await marcarError(id, err instanceof Error ? err.message.slice(0, 300) : "No se pudo procesar el documento");
  }
}

export async function listarDocumentos() {
  return db
    .select({
      id: conocimientoDocumentos.id,
      nombre: conocimientoDocumentos.nombre,
      mime: conocimientoDocumentos.mime,
      tamano: conocimientoDocumentos.tamano,
      estado: conocimientoDocumentos.estado,
      error: conocimientoDocumentos.error,
      fragmentos: conocimientoDocumentos.fragmentos,
      modeloEmbedding: conocimientoDocumentos.modeloEmbedding,
      createdAt: conocimientoDocumentos.createdAt,
    })
    .from(conocimientoDocumentos)
    .orderBy(desc(conocimientoDocumentos.createdAt));
}

export async function borrarDocumento(id: string): Promise<boolean> {
  const borrados = await db
    .delete(conocimientoDocumentos)
    .where(eq(conocimientoDocumentos.id, id))
    .returning({ id: conocimientoDocumentos.id });
  cache = null;
  return borrados.length > 0;
}

/** Nombres de los documentos listos, para el CONTEXTO del agente (FR-007). */
export async function documentosListos(): Promise<string[]> {
  const filas = await db
    .select({ nombre: conocimientoDocumentos.nombre })
    .from(conocimientoDocumentos)
    .where(eq(conocimientoDocumentos.estado, "listo"))
    .orderBy(asc(conocimientoDocumentos.createdAt));
  return filas.map((f) => f.nombre);
}

// --- Busqueda ----------------------------------------------------------------

interface FragmentoCargado {
  documento: string;
  modelo: string | null;
  contenido: string;
  embedding: number[] | null;
}

/**
 * Fragmentos en memoria del proceso. Se invalida al subir o borrar, y por firma (cantidad
 * y ultima modificacion) por si otro proceso cambio la base.
 */
let cache: { firma: string; filas: FragmentoCargado[] } | null = null;

async function cargarFragmentos(): Promise<FragmentoCargado[]> {
  const [f] = await db
    .select({
      n: sql<number>`count(*)::int`,
      ultima: sql<string>`coalesce(max(${conocimientoDocumentos.updatedAt})::text, '')`,
    })
    .from(conocimientoDocumentos)
    .where(eq(conocimientoDocumentos.estado, "listo"));
  const firma = `${f?.n ?? 0}|${f?.ultima ?? ""}`;
  if (cache?.firma === firma) return cache.filas;
  const filas = await db
    .select({
      documento: conocimientoDocumentos.nombre,
      modelo: conocimientoDocumentos.modeloEmbedding,
      contenido: conocimientoFragmentos.contenido,
      embedding: conocimientoFragmentos.embedding,
    })
    .from(conocimientoFragmentos)
    .innerJoin(conocimientoDocumentos, eq(conocimientoFragmentos.documentoId, conocimientoDocumentos.id))
    .where(eq(conocimientoDocumentos.estado, "listo"))
    .orderBy(asc(conocimientoFragmentos.documentoId), asc(conocimientoFragmentos.orden));
  cache = { firma, filas };
  return filas;
}

export interface ResultadoBusqueda {
  documento: string;
  contenido: string;
  puntaje: number;
}

export async function buscarConocimiento(consulta: string, limite = 5): Promise<ResultadoBusqueda[]> {
  const filas = await cargarFragmentos();
  if (filas.length === 0) return [];
  const modelo = modeloEmbedding();
  // Solo se vectoriza la consulta si hay fragmentos del mismo modelo: vectores de modelos
  // distintos no se comparan.
  const hayDelModelo = filas.some((f) => f.modelo === modelo && f.embedding);
  const [vector] = hayDelModelo ? await vectorizar([consulta], modelo, "query") : [null];
  return filas
    .map((f) => ({
      documento: f.documento,
      contenido: f.contenido,
      puntaje: puntuar(consulta, f.modelo === modelo ? vector : null, f),
    }))
    .filter((r) => r.puntaje > 0.15)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, limite);
}
