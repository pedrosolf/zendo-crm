/**
 * Piezas puras del Estudio: validacion de slugs, generacion de config/cliente.ts,
 * lectura del perfil activo y validacion de PNG. Sin fs ni server-only: las prueba
 * tests/estudio.test.ts y las puede usar el navegador.
 *
 * Ver specs/nucleo/12-estudio.md.
 */

/** Identificador de un perfil: carpeta en config/perfiles/ y en public/marca/. */
export const PATRON_SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function slugValido(slug: unknown): slug is string {
  return typeof slug === "string" && PATRON_SLUG.test(slug) && !slug.endsWith("-");
}

/** "Clinica Dental Sur" -> "clinica-dental-sur". Puede devolver "" si no queda nada. */
export function slugDesdeNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** Clave snake_case para etapas y campos: "Visita agendada" -> "visita_agendada". */
export function claveDesdeTexto(texto: string): string {
  const base = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) return "";
  return /^[a-z]/.test(base) ? base : `c_${base}`;
}

/** Marca que el Estudio deja en cliente.ts para reconocer un archivo suyo. */
export const MARCA_GENERADO = "GENERADO POR EL ESTUDIO";

/** Contenido de config/cliente.ts que carga el perfil `slug`. */
export function generarClienteTs(slug: string): string {
  if (!slugValido(slug)) throw new Error(`slug invalido: ${slug}`);
  return `import { definirConfig, type ConfigClienteEntrada } from "@/lib/config/schema";
import modulos from "./modulos.json";
import perfil from "./perfiles/${slug}/config.json";

/**
 * CONFIGURACION DEL CLIENTE — ${MARCA_GENERADO} (/estudio).
 *
 * Carga el perfil activo: config/perfiles/${slug}/config.json. Para cambiar de cliente
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
`;
}

/**
 * Perfil que carga un config/cliente.ts, o null si el archivo esta escrito a mano
 * (no importa ningun perfil).
 */
export function perfilActivoDesde(clienteTs: string): string | null {
  const m = clienteTs.match(/from\s+["']\.\/perfiles\/([^/"']+)\/config\.json["']/);
  return m && slugValido(m[1]) ? m[1] : null;
}

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Tamano maximo de un logo o icono subido desde el Estudio. */
export const MAX_BYTES_MARCA = 2 * 1024 * 1024;

/** true si los bytes empiezan con la firma de PNG. No confia en el nombre ni en el tipo. */
export function esPng(bytes: Uint8Array): boolean {
  if (bytes.length < FIRMA_PNG.length) return false;
  return FIRMA_PNG.every((b, i) => bytes[i] === b);
}

export const ASSETS_MARCA = ["logo", "icono"] as const;
export type AssetMarca = (typeof ASSETS_MARCA)[number];

export function rutaPublicaAsset(slug: string, asset: AssetMarca): string {
  return `/marca/${slug}/${asset}.png`;
}
