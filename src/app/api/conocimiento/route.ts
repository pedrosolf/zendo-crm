import { after, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { crearDocumento, listarDocumentos, procesarDocumento } from "@/lib/conocimiento";
import { detectarTipo, MAX_BYTES_CONOCIMIENTO } from "@/lib/conocimiento/puro";

export const dynamic = "force-dynamic";
// Extraer y vectorizar un PDF largo puede tardar: after() sigue corriendo tras responder.
export const maxDuration = 300;

/** Documentos de la base de conocimiento (specs/nucleo/13). Solo admin. */
export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await listarDocumentos());
}

/** Sube un PDF, TXT o MD (multipart, campo `archivo`). Responde y procesa en after(). */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const largo = Number(req.headers.get("content-length") ?? 0);
  if (largo > MAX_BYTES_CONOCIMIENTO + 64 * 1024) {
    return NextResponse.json({ error: "El archivo pesa mas de 15 MB." }, { status: 400 });
  }
  const form = await req.formData().catch(() => null);
  const archivo = form?.get("archivo");
  if (!archivo || typeof archivo === "string") {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (bytes.length > MAX_BYTES_CONOCIMIENTO) {
    return NextResponse.json({ error: "El archivo pesa mas de 15 MB." }, { status: 400 });
  }
  const mime = detectarTipo(bytes, archivo.name);
  if (!mime) {
    return NextResponse.json({ error: "Solo se aceptan PDF, TXT o MD." }, { status: 400 });
  }

  const id = await crearDocumento({ nombre: archivo.name, mime, tamano: bytes.length, subidoPor: auth.member.id });
  after(() => procesarDocumento(id, bytes, mime));
  return NextResponse.json({ id, estado: "procesando" }, { status: 202 });
}
