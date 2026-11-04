import { conEstudio } from "@/lib/estudio/api";
import { activarPerfil } from "@/lib/estudio/perfiles";

export const dynamic = "force-dynamic";

/** Activa el perfil: reescribe config/cliente.ts y aplica su config (FR-007). */
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return conEstudio(async () => ({ ok: true, aplicado: await activarPerfil(slug) }));
}
