/**
 * El Estudio escribe archivos del repo (config/, public/marca/): solo tiene sentido en
 * la maquina de quien adapta el CRM (`npm run dev` o `npm run local`). En una imagen
 * desplegada el sistema de archivos es efimero y la config sale del repo, asi que ahi
 * no existe: la pagina y la API responden 404.
 *
 * El candado es NODE_ENV, que no depende de configuracion: `next build` + `next start`
 * y la imagen de Docker corren siempre en production. Ver specs/nucleo/12-estudio.md.
 */
export function estudioDisponible(): boolean {
  return process.env.NODE_ENV !== "production";
}
