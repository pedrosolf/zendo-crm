import type { ConfigClienteEntrada } from "@/lib/config/schema";

/** Lo que recibe cada paso del asistente del Estudio. */
export interface PropsPaso {
  config: ConfigClienteEntrada;
  cambiar: (fn: (c: ConfigClienteEntrada) => ConfigClienteEntrada) => void;
  /** Errores del esquema, `ruta: mensaje`. */
  errores: string[];
}
