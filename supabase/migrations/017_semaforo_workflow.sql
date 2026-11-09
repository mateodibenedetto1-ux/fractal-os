-- 017 · Semáforo de clientes, KPIs semanales, workflow por cliente y contenido completo del Laboratorio

-- Laboratorio: el cuerpo de la página de Notion (ej. transcripciones completas)
alter table lab_entries add column if not exists body text;
alter table lab_entries add column if not exists notion_edited timestamptz;

-- Workflow semanal del cliente (lo ve el cliente en su portal): [{ "dow": 2, "title": "...", "side": "fractal", "responsable": "Nacho" }]
alter table organizations add column if not exists workflow jsonb not null default '[]'::jsonb;

-- Semáforo: solo equipo
create table if not exists client_health (
  org_id      uuid primary key references organizations(id) on delete cascade,
  color       text check (color in ('verde','amarillo','rojo')),
  importance  text check (importance in ('alta','media','baja')),
  note        text,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

create table if not exists client_health_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  color       text check (color in ('verde','amarillo','rojo')),
  note        text,
  author      text,
  created_at  timestamptz not null default now()
);
create index if not exists client_health_log_org_idx on client_health_log (org_id, created_at desc);

-- KPIs de la semana por cliente (plan vs. real)
create table if not exists client_kpis (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  week        date not null,                 -- lunes de la semana
  name        text not null,
  target      numeric not null default 0,    -- meta de la semana
  actual      numeric not null default 0,
  daily       boolean not null default true, -- true: el plan se reparte por día (plan a la fecha)
  position    int not null default 0,
  updated_at  timestamptz not null default now()
);
create index if not exists client_kpis_org_week_idx on client_kpis (org_id, week);

alter table client_health enable row level security;
alter table client_health_log enable row level security;
alter table client_kpis enable row level security;
drop policy if exists staff_all on client_health;
create policy staff_all on client_health for all using (is_staff()) with check (is_staff());
drop policy if exists staff_all on client_health_log;
create policy staff_all on client_health_log for all using (is_staff()) with check (is_staff());
drop policy if exists staff_all on client_kpis;
create policy staff_all on client_kpis for all using (is_staff()) with check (is_staff());
