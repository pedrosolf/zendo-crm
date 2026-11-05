import { sugerir } from "./clasificador";

export interface ProblemaCatalogo {
  id: number;
  nombre: string;
  tipo_id: number;
  tipo_nombre: string;
  sinonimos: string[];
}

/** "Reposición de luminaria" y "reposicion de luminaria " son la misma categoria. */
export function normalizarNombre(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Categoria de un reclamo a partir de lo que manda el agente. Se resuelve por NOMBRE: es
 * lo que el vecino confirmo y lo que queda en el historial. El agente solo recuerda el
 * texto de la conversacion, no los resultados de tools de turnos anteriores, asi que
 * varios mensajes despues de clasificar inventa el problema_id (registro "Cable
 * chispeando", id 3, habiendo confirmado "Bacheo urbano", id 35). El id solo se usa si no
 * vino nombre; si vienen los dos y no coinciden, gana el nombre.
 */
export function resolverProblema(
  catalogo: ProblemaCatalogo[],
  args: { problema?: unknown; problema_id?: unknown }
): { problema: ProblemaCatalogo } | { error: string } {
  const nombre = normalizarNombre(String(args.problema ?? ""));
  if (nombre) {
    const exacto = catalogo.find((p) => normalizarNombre(p.nombre) === nombre);
    if (exacto) return { problema: exacto };
    const parecidos = sugerir(String(args.problema), catalogo).slice(0, 3).map((s) => s.problema);
    return {
      error: `problema: "${args.problema}" no es una categoria del portal${
        parecidos.length ? `; parecidas: ${parecidos.join(", ")}` : ""
      }. Usa el nombre exacto que devolvio clasificar_reclamo o listar_problemas`,
    };
  }
  const porId = catalogo.find((p) => p.id === Number(args.problema_id));
  return porId ? { problema: porId } : { error: "problema: falta el nombre exacto de la categoria confirmada" };
}
