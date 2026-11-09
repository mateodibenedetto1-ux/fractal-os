-- 019 · Bóveda de reportes de Fractal (espejo de la base de Notion dentro de Fulfillment)
create table if not exists vault_reports (
  id            uuid primary key default gen_random_uuid(),
  notion_id     text unique not null,
  title         text not null,
  tipo          text,
  week_start    date,
  week_end      date,
  clientes      text[] not null default '{}',
  resumen       text,
  body_md       text,
  notion_edited timestamptz,
  updated_at    timestamptz not null default now()
);
alter table vault_reports enable row level security;
drop policy if exists staff_all on vault_reports;
create policy staff_all on vault_reports for all using (is_staff()) with check (is_staff());
