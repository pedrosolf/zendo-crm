import { conEstudio, leerJson } from "@/lib/estudio/api";
import { borrarPerfil, guardarPerfil, leerPerfil, perfilActivo } from "@/lib/estudio/perfiles";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  return conEstudio(async () => ({ slug, activo: slug === perfilActivo(), config: leerPerfil(slug) }));
}

/** Guarda la config completa del perfil. Si es el activo, la aplica (FR-008). */
export async function PUT(req: Request, { params }: Ctx) {
  const { slug } = await params;
  return conEstudio(async () => {
    const body = await leerJson(req);
    const resultado = await guardarPerfil(slug, body.config);
    return { ok: true, aplicado: resultado };
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  return conEstudio(async () => {
    borrarPerfil(slug);
    return { ok: true };
  });
}
