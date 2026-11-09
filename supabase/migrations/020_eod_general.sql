-- 020 · Reporte del día general de Fractal (como el de Notion)
alter table daily_reports add column if not exists next_steps text;
alter table daily_reports add column if not exists top_content text;
alter table daily_reports add column if not exists notes text;
