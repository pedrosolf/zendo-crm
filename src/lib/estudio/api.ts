import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { estudioDisponible } from "./disponible";
import { ErrorEstudio } from "./perfiles";

/**
 * Envoltorio de toda ruta /api/estudio/*: 404 en produccion (FR-003), solo admins, y los
 * ErrorEstudio salen como JSON con su status y la lista de errores por campo.
 */
export async function conEstudio(manejar: () => Promise<unknown>): Promise<NextResponse> {
  if (!estudioDisponible()) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  try {
    const datos = await manejar();
    return NextResponse.json(datos ?? { ok: true });
  } catch (err) {
    if (err instanceof ErrorEstudio) {
      return NextResponse.json({ error: err.message, errores: err.errores }, { status: err.status });
    }
    console.error("[estudio]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error inesperado en el Estudio" },
      { status: 500 }
    );
  }
}

export async function leerJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const datos = await req.json();
    return datos && typeof datos === "object" ? datos : {};
  } catch {
    throw new ErrorEstudio("El cuerpo no es JSON valido.");
  }
}
