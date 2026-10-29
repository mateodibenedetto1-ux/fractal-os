-- Fractal OS · 002 — roadmap por tiempo, conexión con Notion y Laboratorio
-- Idempotente: se puede volver a correr.

-- Bases de Notion de cada cliente
alter table organizations add column if not exists notion_tasks_db text;
alter table organizations add column if not exists notion_roadmap_db text;
alter table organizations add column if not exists notion_calendars jsonb not null default '[]'; -- [{ "id": "...", "label": "Andy" }]
alter table organizations add column if not exists last_synced_at timestamptz;

-- Roadmap: fases (con rango) e hitos (fecha puntual). El estado se calcula por fecha salvo que se fije a mano.
alter table milestones add column if not exists kind text not null default 'hito';
alter table milestones drop constraint if exists milestones_kind_check;
alter table milestones add constraint milestones_kind_check check (kind in ('fase','hito'));
alter table milestones add column if not exists auto_status boolean not null default true;

-- Laboratorio: copia en la app del Atlas de Notion (Notion queda como respaldo y editor alternativo)
create table if not exists lab_entries (
  id          uuid primary key default gen_random_uuid(),
  notion_id   text unique,
  title       text not null,
  tipo        text,      -- Feedback, Falla, Aprendizaje, Hipótesis, Experimento, Decisión, SOP
  area        text,      -- Servicio, Creatividad, Operaciones, Oferta, Comercial, Producto, Finanzas
  estado      text not null default 'Capturado',
  prioridad   text,
  cliente     text,
  responsable text,
  fecha       date,
  fuente      text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table lab_entries enable row level security;
drop policy if exists staff_all on lab_entries;
create policy staff_all on lab_entries for all using (is_staff()) with check (is_staff());
create index if not exists lab_entries_fecha_idx on lab_entries(fecha desc);

-- Fichas del Laboratorio (casos por cliente y criterios). Solo equipo.
create table if not exists lab_pages (
  id         uuid primary key default gen_random_uuid(),
  notion_id  text unique not null,
  section    text not null check (section in ('cliente','criterio')),
  client     text,
  title      text not null,
  happened   text,
  learning   text,
  rule       text,
  summary    text,
  position   int not null default 0
);
alter table lab_pages enable row level security;
drop policy if exists staff_all on lab_pages;
create policy staff_all on lab_pages for all using (is_staff()) with check (is_staff());
