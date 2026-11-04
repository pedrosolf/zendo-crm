import type { ConfigClienteEntrada } from "@/lib/config/schema";
import { plantillaInmobiliaria } from "./inmobiliaria";

/**
 * CATALOGO DE PLANTILLAS DE NICHO — zona del cliente.
 *
 * El Estudio (/estudio) ofrece estas plantillas al crear un perfil nuevo. Para sumar un
 * nicho: crear `config/plantillas/<nicho>.ts` (skill `nueva-plantilla-nicho`) y agregarlo
 * aqui. La `config` se copia tal cual al perfil nuevo; la marca la pone el perfil.
 */
export interface PlantillaNicho {
  clave: string;
  titulo: string;
  descripcion: string;
  config: ConfigClienteEntrada;
}

export const plantillas: PlantillaNicho[] = [
  {
    clave: "inmobiliaria",
    titulo: "Inmobiliaria",
    descripcion:
      "Venta y arriendo: pipeline con visitas, campos de operacion, zona y presupuesto, modulos de propiedades y visitas.",
    config: plantillaInmobiliaria,
  },
];
