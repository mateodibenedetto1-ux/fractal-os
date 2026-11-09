-- 018 · Reporte del día (EOD), KPIs por día y strikes

alter table client_kpis add column if not exists owner text default 'Nacho';

-- Valor de cada KPI por día (el real de la semana es la suma)
create table if not exists kpi_daily (
  kpi_id     uuid not null references client_kpis(id) on delete cascade,
  day        date not null,
  value      numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (kpi_id, day)
);

-- Reporte del día del equipo (reemplaza el formulario de Notion; se copia a Fulfillment Reports)
create table if not exists daily_reports (
  id         uuid primary key default gen_random_uuid(),
  day        date not null,
  author     text not null,
  done       text,
  pending    text,
  blockers   text,
  published  numeric,
  planned    numeric,
  notion_id  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day, author)
);

-- Strikes: dos días seguidos de incumplimiento
create table if not exists strikes (
  id         uuid primary key default gen_random_uuid(),
  day        date not null,
  kind       text not null check (kind in ('kpi','reporte')),
  subject    text not null,
  org_id     uuid references organizations(id) on delete cascade,
  owner      text,
  reason     text,
  status     text not null default 'abierto' check (status in ('abierto','cerrado')),
  measure    text,
  closed_by  text,
  created_at timestamptz not null default now(),
  unique (kind, subject, day)
);

alter table kpi_daily enable row level security;
alter table daily_reports enable row level security;
alter table strikes enable row level security;
drop policy if exists staff_all on kpi_daily;
create policy staff_all on kpi_daily for all using (is_staff()) with check (is_staff());
drop policy if exists staff_all on daily_reports;
create policy staff_all on daily_reports for all using (is_staff()) with check (is_staff());
drop policy if exists staff_all on strikes;
create policy staff_all on strikes for all using (is_staff()) with check (is_staff());
