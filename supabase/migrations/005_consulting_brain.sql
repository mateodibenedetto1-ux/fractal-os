-- 005 · Clientes de Consulting y su Segundo cerebro

alter table organizations add column if not exists segment text not null default 'b2b';
alter table organizations drop constraint if exists organizations_segment_check;
alter table organizations add constraint organizations_segment_check check (segment in ('b2b', 'consulting'));

-- Respuestas del Segundo cerebro: un JSON por cliente con claves "seccion.campo"
create table if not exists client_brain (
  org_id     uuid primary key references organizations(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table client_brain enable row level security;
drop policy if exists brain_rw on client_brain;
create policy brain_rw on client_brain for all using (can_see_org(org_id)) with check (can_see_org(org_id));

-- Etapas del recorrido: a qué sección del Segundo cerebro corresponde cada fase y cada tarea
alter table milestones add column if not exists brain_section text;
alter table action_items add column if not exists brain_section text;
