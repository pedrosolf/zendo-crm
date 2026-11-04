-- ============================================================================
-- Builder CRM - base de conocimiento del agente (specs/nucleo/13-base-de-conocimiento.md)
-- ============================================================================
-- Documentos que el admin sube (catalogos, listas de precios, tramites) partidos en
-- fragmentos con su embedding. El archivo original no se guarda: solo su texto.
--
-- El embedding es real[] y no vector(n) a proposito: la base embebida del modo local no
-- trae pgvector y el tamano depende del modelo (EMBEDDING_MODEL). La similitud se
-- calcula en el servidor. Un fragmento puede no tener embedding (el modelo fallo): la
-- busqueda por palabras lo sigue encontrando.
-- ============================================================================

create table if not exists public.conocimiento_documentos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  mime text not null,
  tamano integer not null,
  -- procesando | listo | error
  estado text not null default 'procesando',
  error text,
  modelo_embedding text,
  fragmentos integer not null default 0,
  subido_por uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conocimiento_fragmentos (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.conocimiento_documentos(id) on delete cascade,
  orden integer not null,
  contenido text not null,
  embedding real[],
  created_at timestamptz not null default now()
);

create index if not exists conocimiento_fragmentos_documento_idx
  on public.conocimiento_fragmentos (documento_id, orden);

-- RLS: como el resto del nucleo, authenticated solo lee si es miembro activo. La app
-- entra como postgres (bypass); anon no tiene nada.
alter table public.conocimiento_documentos enable row level security;
alter table public.conocimiento_fragmentos enable row level security;

drop policy if exists conocimiento_documentos_select on public.conocimiento_documentos;
create policy conocimiento_documentos_select on public.conocimiento_documentos
  for select to authenticated using (public.es_miembro());

drop policy if exists conocimiento_fragmentos_select on public.conocimiento_fragmentos;
create policy conocimiento_fragmentos_select on public.conocimiento_fragmentos
  for select to authenticated using (public.es_miembro());
