"use client";

import { toast } from "sonner";
import type { ResultadoAplicar } from "@/lib/estudio/tipos";

/**
 * Cuenta lo que paso al aplicar un perfil. Si cambiaron los modulos hace falta migrar y
 * reiniciar (FR-010); si no, se recarga para ver la marca nueva en toda la app.
 */
export function avisarResultado(r: ResultadoAplicar, titulo: string, recargar = false) {
  const p = r.pipeline;
  const detalle = p ? `Pipeline: ${p.creadas} etapas nuevas, ${p.actualizadas} actualizadas.` : undefined;
  toast.success(titulo, { description: detalle });
  for (const aviso of r.avisos) toast.warning(aviso);
  if (r.modulosCambiaron) {
    toast.warning("Cambiaron los modulos activos", {
      description:
        "Aplica las migraciones y reinicia el servidor: npm run db:migrar y despues reiniciar npm run dev (en modo local, reiniciar npm run local).",
      duration: 20000,
    });
    return;
  }
  if (recargar) setTimeout(() => window.location.reload(), 1500);
}
