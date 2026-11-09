/**
 * Contingencia del agente cuando el modelo no responde. Logica pura (sin base ni red)
 * para poder probarla. Ver specs/nucleo/14-contingencia-del-agente.md.
 *
 *   1. Cadena de modelos: el principal y despues los respaldos, en orden. Un respaldo
 *      puede ser de otro proveedor ("openrouter:google/gemini-2.5-flash").
 *   2. Presupuesto de tiempo: la plataforma corta la funcion (Vercel, 60 s) y un job
 *      cortado queda en "processing" sin error. Cada llamada tiene un tope y el turno
 *      entero tambien.
 *   3. Si no queda modelo ni tiempo, se avisa al cliente con
 *      config.agente.mensajeSinServicio, una sola vez cada 30 minutos por hilo.
 */

export type Proveedor = "openrouter" | "nvidia";

export interface EslabonModelo {
  proveedor: Proveedor;
  modelo: string;
}

/**
 * Arma la cadena: principal -> AGENT_MODEL_FALLBACK (lista separada por comas) ->
 * respaldo por defecto del proveedor (solo si no hay lista). "off" deja solo el
 * principal. Sin duplicados.
 */
export function cadenaDeModelos(opts: {
  proveedor: Proveedor;
  principal: string;
  respaldoEnv?: string;
  respaldoDefault?: string;
}): EslabonModelo[] {
  const cadena: EslabonModelo[] = [{ proveedor: opts.proveedor, modelo: opts.principal }];
  const env = opts.respaldoEnv?.trim();
  if (env?.toLowerCase() === "off") return cadena;

  const entradas = env
    ? env.split(",").map((x) => x.trim()).filter(Boolean)
    : opts.respaldoDefault
      ? [opts.respaldoDefault]
      : [];

  for (const entrada of entradas) {
    const m = /^(openrouter|nvidia):(.+)$/i.exec(entrada);
    const eslabon: EslabonModelo = m
      ? { proveedor: m[1].toLowerCase() as Proveedor, modelo: m[2].trim() }
      : { proveedor: opts.proveedor, modelo: entrada };
    if (!cadena.some((e) => e.proveedor === eslabon.proveedor && e.modelo === eslabon.modelo)) {
      cadena.push(eslabon);
    }
  }
  return cadena;
}

/** Margen que se reserva al final del turno para mandar el aviso y cerrar el job. */
export const MARGEN_FINAL_MS = 5_000;

/**
 * Cuanto puede esperar la proxima llamada al modelo. 0 = no queda tiempo: no llamar y
 * pasar directo al aviso.
 */
export function tiempoParaLlamada(restanteMs: number, topePorLlamadaMs: number): number {
  const disponible = restanteMs - MARGEN_FINAL_MS;
  if (disponible < 3_000) return 0;
  return Math.min(topePorLlamadaMs, disponible);
}

/** Ventana en la que no se repite el aviso en la misma conversacion. */
export const VENTANA_AVISO_MS = 30 * 60_000;

/**
 * Hay que mandar el aviso? No, si el ultimo mensaje saliente del hilo ya fue el mismo
 * aviso hace menos de 30 minutos: tres mensajes seguidos del cliente no merecen tres
 * "estoy fuera de servicio".
 */
export function debeAvisar(
  ultimoSaliente: { body: string | null; createdAt: Date } | null,
  aviso: string,
  ahora: Date = new Date()
): boolean {
  if (!ultimoSaliente) return true;
  if ((ultimoSaliente.body ?? "").trim() !== aviso.trim()) return true;
  return ahora.getTime() - ultimoSaliente.createdAt.getTime() >= VENTANA_AVISO_MS;
}
