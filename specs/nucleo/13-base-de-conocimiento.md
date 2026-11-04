# Spec: Base de conocimiento del agente (documentos vectorizados)

**Carril**: completo (tablas nuevas, tool del nucleo, dependencia nueva)
**Estado**: aprobada
**Fecha**: 2026-11-04
**Escrita antes del codigo**: si

## Problema

El agente solo sabe lo que dice su prompt. Un cliente que vende por catalogo (o un
municipio con sus tramites, horarios y requisitos) necesita que el agente responda con
esa informacion, que vive en PDFs largos que no entran en un prompt. Hoy no hay forma de
dejarle documentos al agente.

## Decisiones del dueno

- D1 (2026-11-04) Subir documentos (por ejemplo un catalogo PDF) y "vectorizarlos" para
  que el agente los use.
- D2 (diseno) Se suben desde Ajustes (admin), asi funciona tambien en produccion: es
  contenido del cliente, no configuracion del repo.
- D3 (diseno) Embeddings por OpenRouter (la misma clave del agente), modelo por
  `EMBEDDING_MODEL`, default gratuito `nvidia/nemotron-3-embed-1b:free`. Los vectores se
  guardan como `real[]` y la similitud se calcula en el servidor: funciona igual en
  Supabase y en la base embebida del modo local, sin extension pgvector. Alcanza para
  miles de fragmentos; si un cliente necesita mas, se migra a pgvector.
- D4 (diseno) Si el modelo de embeddings falla (los gratuitos se caen), el documento se
  guarda igual y la busqueda cae a coincidencia por palabras. El agente nunca se queda
  sin respuesta por un embedding.

## Escenarios

1. **Subir** — El admin abre Ajustes -> Base de conocimiento y sube un PDF, TXT o MD
   (max 15 MB). Ve "Procesando" y al rato "Listo · N fragmentos".
2. **Preguntar** — Un cliente escribe "cuanto salen las zapatillas de running?"; el agente
   llama `buscar_conocimiento`, recibe los fragmentos relevantes del catalogo y responde
   con esos datos, sin inventar.
3. **Sin respuesta** — Si la busqueda no trae nada relevante, el agente dice que no tiene
   ese dato y ofrece derivar.
4. **Borrar** — El admin borra un documento; el agente deja de usarlo.
5. **Error** — Un PDF escaneado (solo imagen) queda en "Error: no tiene texto".

## Requisitos

- FR-001 Tablas `conocimiento_documentos` (nombre, mime, tamano, estado
  `procesando|listo|error`, error, modelo de embeddings, fragmentos, quien subio) y
  `conocimiento_fragmentos` (documento, orden, contenido, `embedding real[]` nullable).
  Borrar el documento borra sus fragmentos. RLS en ambas.
- FR-002 Extraccion de texto: PDF con `unpdf`; TXT y MD tal cual. Sin texto -> error.
- FR-003 Fragmentacion: ~1200 caracteres con solape de ~200, cortando en parrafo o frase.
- FR-004 Embeddings en lotes por `POST /api/v1/embeddings` de OpenRouter. Un lote que
  falla deja esos fragmentos sin vector (D4), no aborta el documento.
- FR-005 El procesamiento corre despues de responder (`after()`); la UI consulta el
  estado.
- FR-006 `buscar_conocimiento({ consulta })`: vectoriza la consulta, coseno contra los
  fragmentos del mismo modelo, mas un puntaje por palabras para todos. Devuelve los 5
  mejores con el nombre del documento. Sin documentos: lo dice.
- FR-007 Si hay documentos listos, el CONTEXTO del agente lo menciona con sus nombres y le
  indica usar `buscar_conocimiento` antes de responder sobre esos temas.
- FR-008 API: `GET/POST /api/conocimiento`, `DELETE /api/conocimiento/:id`. Solo admin.
  El archivo no se guarda: solo su texto fragmentado.
- FR-009 Validacion del archivo por contenido (firma `%PDF-` para PDF; texto UTF-8 valido
  para TXT/MD), no por extension.

## Configuracion y modulos

Variable nueva opcional `EMBEDDING_MODEL`. Ningun cambio en `config/cliente.ts`.

## Modelo de datos

Migracion `supabase/migrations/20261104000000_conocimiento.sql` (tablas de FR-001, RLS,
lectura para `authenticated` miembro del equipo como el resto).

## Agente de IA

Tool nueva del nucleo `buscar_conocimiento` (se puede apagar en Ajustes -> Agente como las
demas). CONTEXTO agrega BASE DE CONOCIMIENTO cuando hay documentos listos.

## Criterios de aceptacion

- CA-001 Subir un PDF de catalogo queda "listo" con fragmentos y vectores.
- CA-002 En el Simulador, una pregunta sobre un producto del PDF se responde con su precio
  real, y la conversacion muestra la llamada a `buscar_conocimiento`.
- CA-003 Un archivo `.pdf` que no es PDF se rechaza con 400.
- CA-004 Borrar el documento borra sus fragmentos.
- CA-005 Con el modelo de embeddings caido, la busqueda por palabras igual devuelve el
  fragmento correcto (test).
- CA-006 `npm test && npm run typecheck && npm run lint && npm run build` en verde;
  `npm audit --omit=dev` en 0.

## Constitution Check

- I. Nucleo generico: sirve a cualquier rubro; el contenido es del cliente y vive en su base.
- II. Spec antes que codigo: si.
- III. Autoverificacion: CA-002 en el Simulador.
- IV. Cero secretos: usa `OPENROUTER_API_KEY` del entorno; tablas con RLS.
