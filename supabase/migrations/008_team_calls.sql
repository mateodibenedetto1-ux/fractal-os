-- 008: reuniones internas del equipo (daily, creativity core, editores) y su aprendizaje en el Laboratorio
alter table calls add column if not exists team_kind text;
alter table lab_entries add column if not exists call_id uuid references calls(id) on delete set null;
alter table organizations add column if not exists team_titles jsonb not null default '[]'::jsonb;
