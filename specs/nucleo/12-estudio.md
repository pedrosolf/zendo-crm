# Spec: Estudio (adaptar el CRM a un cliente desde una pantalla, con perfiles)

**Carril**: completo (toca el nucleo y la forma en que se carga `config/cliente.ts`)
**Estado**: fase 1 implementada (2026-11-04, CA-001 a CA-008 en verde); fase 2 pendiente
**Fecha**: 2026-11-04
**Escrita antes del codigo**: si

## Problema

Hoy adaptar el CRM a un cliente es editar `config/cliente.ts` a mano (o pedirselo a
Claude): marca, pipeline, campos, agente y modulos. Funciona, pero exige saber TypeScript,
conocer el esquema y reiniciar para ver el resultado. Ademas una instancia de desarrollo
tiene un solo cliente: para preparar o mostrar otro hay que reescribir la config.

Se quiere un **Estudio**: una pantalla de admin con un asistente guiado, paso a paso y
con explicaciones, que edita la configuracion del cliente; y **perfiles**, uno por
cliente, para cambiar de uno a otro con un click y crear nuevos (desde cero, desde una
plantilla de nicho o duplicando otro).

## Decisiones del dueno

- D1 (2026-11-04) Lo usan **ambos**: el miembro al armar clientes (fase 1, local/dev) y el
  admin del cliente en produccion (fase 2). Se construye en dos fases.
- D2 (2026-11-04) Es para uso propio, no una mejora para todos los miembros: se puede
  cambiar el nucleo sin el proceso de version del repo original. Igual se hace generico
  (nada de un cliente en `src/`).
- D3 (diseno) La configuracion sigue siendo un archivo versionado en git (decision D1 de
  la spec 02). El Estudio no la mueve a la base: escribe archivos de la zona del cliente.
  Por eso la fase 1 solo existe fuera de produccion.

## Escenarios

1. **Ver perfiles** — El admin abre `/estudio` y ve la lista de perfiles (uno por
   cliente) con su nombre, colores y cual esta activo.
2. **Crear** — Crea un perfil nuevo desde cero, desde una plantilla de nicho
   (`inmobiliaria`) o duplicando otro. Elige nombre; el identificador (slug) sale solo.
3. **Adaptar con guia** — Edita el perfil en un asistente de 7 pasos: Negocio, Marca,
   Pipeline, Campos del contacto, Agente, Modulos y Revisar. Cada paso tiene un panel de
   guia (que es, para que sirve, ejemplos, errores comunes) y valida en vivo con el mismo
   esquema que usa el nucleo. La marca tiene vista previa (sidebar, boton, login).
4. **Subir marca** — Sube logo e icono en PNG; quedan en `public/marca/<perfil>/`.
5. **Activar** — Activa un perfil: el CRM entero pasa a esa marca, pipeline, campos y
   agente sin reiniciar (salvo que cambien los modulos, ver FR-010). Las etapas nuevas
   aparecen en `/pipeline`.
6. **Editar el activo** — Guardar cambios en el perfil activo los aplica al instante.
7. **Borrar** — Borra un perfil que no esta activo.
8. **Produccion** — En una instancia desplegada `/estudio` y su API responden 404 y el
   enlace no aparece.

## Requisitos

### Fase 1 — Estudio en local/dev

- FR-001 Un perfil es la carpeta `config/perfiles/<slug>/` con `config.json` (la
  configuracion del cliente, misma forma que `config/cliente.ts`, validada con
  `esquemaConfig`). Slug: `^[a-z0-9][a-z0-9-]{0,39}$`. Los assets van en
  `public/marca/<slug>/logo.png` e `icono.png`.
- FR-002 `config/cliente.ts` importa el `config.json` del perfil activo y toma los
  modulos activos de `config/modulos.json`. El Estudio lo regenera al activar; el perfil
  activo se lee de esa linea de import. Si `cliente.ts` esta escrito a mano (no importa un
  perfil), el Estudio lo dice y ofrece **importarlo como perfil** (a partir de la config
  ya validada).
- FR-003 El Estudio esta disponible solo si `NODE_ENV !== "production"`. En produccion la
  pagina y toda la API `/api/estudio/*` responden 404. Ademas, cada ruta exige
  `requireAdmin()`.
- FR-004 Toda escritura valida antes con `esquemaConfig` (y que los modulos existan en
  `modules/`); si es invalida no escribe nada y devuelve la lista de errores por campo.
- FR-005 Ninguna ruta se construye con datos del usuario sin validar el slug: no hay
  forma de escribir fuera de `config/perfiles/` y `public/marca/`.
- FR-006 Subida de marca: solo PNG (firma de bytes), maximo 2 MB. Al subir el icono del
  perfil activo se regeneran los iconos de la PWA (`scripts/pwa-icons.mjs`).
- FR-007 Activar: escribe `config/cliente.ts` y `config/modulos.json`, regenera el
  registro de modulos, sincroniza el pipeline con la config del perfil (sin depender de
  que el bundler ya haya recargado el modulo) y regenera los iconos de la PWA.
- FR-008 Guardar el perfil activo hace lo mismo que activar, salvo reescribir
  `cliente.ts`.
- FR-009 Plantillas de nicho: `config/plantillas/index.ts` exporta el catalogo
  (`clave`, `titulo`, `descripcion`, `config`). Crear desde plantilla copia su config al
  perfil nuevo con la marca del perfil.
- FR-010 Si cambian los modulos activos, el Estudio avisa que hace falta aplicar
  migraciones y reiniciar (`npm run db:migrar` + reiniciar `npm run dev`, o reiniciar
  `npm run local`), porque las tablas de un modulo no existen hasta migrar.
- FR-011 Las guias de cada paso viven en el nucleo y son genericas (ningun rubro en
  particular salvo como ejemplo entre varios).
- FR-012 El sidebar muestra "Estudio" solo a admins y solo si el Estudio esta disponible
  (capacidad `estudio` en la configuracion publica).
- FR-013 Los perfiles comparten la misma base: cambiar de perfil no borra contactos ni
  conversaciones del otro. De las etapas que sobran, se borran solo las que vinieron de
  una config (tienen `key`) y no tienen operaciones; las que tienen operaciones y las
  creadas a mano desde la UI se conservan (`sincronizarPipeline({ borrarSobrantes:
  "con-clave" })`). Sin esto, cada cambio de perfil apilaria las etapas del anterior.

### Fase 2 — Ajustes del cliente en produccion (pendiente)

- FR-101 [PENDIENTE] Un subconjunto editable por el admin del cliente en su instancia
  desplegada: marca (nombre, descripcion, colores, logo), etiquetas de etapas y prompt
  del agente. Se guarda en la base como capa sobre la config del archivo.
- FR-102 [PENDIENTE] `getConfig()` hoy es sincrono e importable desde el navegador; la
  capa de la base obliga a servir la config efectiva en el bloque de configuracion
  publica. Hay que disenarlo antes de construirlo.

## Configuracion y modulos

- `config/cliente.ts` pasa a importar el perfil activo.
- La configuracion actual se migra al perfil `builder-crm` (sin cambios de contenido).
- Nuevo `config/plantillas/index.ts` (catalogo) y `config/perfiles/README.md`.
- Ningun modulo nuevo.

## Modelo de datos

Ninguno. `sincronizarPipeline()` acepta opcionalmente el pipeline a sincronizar.

## Agente de IA

Sin cambios en el comportamiento. El prompt, el nombre y el mensaje de derivacion del
perfil se editan en el paso Agente (es `config.agente`; sigue la cascada de siempre:
canal -> global de Ajustes -> config -> default).

## Criterios de aceptacion

- CA-001 Con `npm run dev`, un admin entra a `/estudio` y ve el perfil `builder-crm` como
  activo.
- CA-002 Crear un perfil desde la plantilla inmobiliaria, cambiarle nombre y color,
  activarlo: el sidebar y el titulo cambian sin reiniciar y `/pipeline` muestra las etapas
  de la plantilla.
- CA-003 Guardar una config invalida (color `rojo`, dos etapas con la misma clave) no
  escribe nada y muestra el error en el campo.
- CA-004 Un slug con `../` o con mayusculas se rechaza con 400.
- CA-005 Subir un archivo que no es PNG se rechaza.
- CA-006 Con `NODE_ENV=production` (`next build && next start`), `/api/estudio` da 404.
- CA-007 Volver a activar `builder-crm` deja `config/cliente.ts` y `config/modulos.json`
  como estaban: `git status` limpio en `config/` salvo `config/perfiles/` nuevos.
- CA-008 `npm test && npm run typecheck && npm run lint && npm run build` en verde, y
  `verificar-instancia` en verde con el perfil activo.

## Constitution Check

- I. Nucleo no se modifica para un cliente: el Estudio es generico; lo de cada cliente
  queda en `config/perfiles/` y `public/marca/<perfil>/` (zona del cliente). D2 autoriza
  el cambio de nucleo.
- II. Spec antes que codigo: si, esta.
- III. Autoverificacion: CA-008 incluye `verificar-instancia`.
- IV. Cero secretos: los perfiles son configuracion, no credenciales; el Estudio no lee
  ni escribe `.env*`.
