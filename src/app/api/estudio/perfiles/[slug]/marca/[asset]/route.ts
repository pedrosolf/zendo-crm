import { conEstudio } from "@/lib/estudio/api";
import { ErrorEstudio, guardarAsset } from "@/lib/estudio/perfiles";
import { MAX_BYTES_MARCA } from "@/lib/estudio/archivos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; asset: string }> };

/** Sube el logo o el icono del perfil (multipart, campo `archivo`). Solo PNG, 2 MB (FR-006). */
export async function POST(req: Request, { params }: Ctx) {
  const { slug, asset } = await params;
  return conEstudio(async () => {
    const largo = Number(req.headers.get("content-length") ?? 0);
    if (largo > MAX_BYTES_MARCA + 64 * 1024) throw new ErrorEstudio("La imagen pesa mas de 2 MB.");
    const form = await req.formData().catch(() => null);
    const archivo = form?.get("archivo");
    if (!archivo || typeof archivo === "string") throw new ErrorEstudio("Falta el archivo.");
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const ruta = await guardarAsset(slug, asset, bytes);
    return { ok: true, ruta: `${ruta}?v=${Date.now()}` };
  });
}
