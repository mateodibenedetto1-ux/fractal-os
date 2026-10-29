-- 004 · Tracker interno de Fractal: tareas del equipo en la cuenta principal, con cliente opcional

alter table organizations add column if not exists notion_client_page text;
alter table action_items add column if not exists client_org_id uuid references organizations(id) on delete set null;
