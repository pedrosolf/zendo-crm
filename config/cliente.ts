import { definirConfig, type ConfigClienteEntrada } from "@/lib/config/schema";
import modulos from "./modulos.json";
import perfil from "./perfiles/municipalidad/config.json";

/**
 * CONFIGURACION DEL CLIENTE — GENERADO POR EL ESTUDIO (/estudio).
 *
 * Carga el perfil activo: config/perfiles/municipalidad/config.json. Para cambiar de cliente
 * se activa otro perfil desde el Estudio, que reescribe este archivo. Para editar la
 * configuracion se usa el Estudio o se edita ese config.json (mismo esquema que
 * src/lib/config/schema.ts). Los modulos activos salen de config/modulos.json, que
 * tambien leen el runner de migraciones y el generador del registro.
 */
const config = perfil as unknown as ConfigClienteEntrada;

export default definirConfig({
  ...config,
  modulos: { ...config.modulos, activos: modulos.activos },
});
