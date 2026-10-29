-- 003 · Responsable por accionable y cola de cambios pendientes de subir a Notion

alter table organizations add column if not exists responsables jsonb not null default '[]'::jsonb;
-- Cada elemento: { "name": "Marcela", "side": "cliente" | "fractal", "notion_user": "<uuid de usuario de Notion, opcional>" }

alter table action_items add column if not exists responsable text;
alter table action_items add column if not exists notion_dirty boolean not null default false;

create index if not exists action_items_dirty_idx on action_items (org_id) where notion_dirty;

-- El cliente solo puede marcar como hecho; el responsable también queda protegido
create or replace function guard_client_action_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_staff() then
    if (new.title, new.org_id, new.call_id, new.parent_id, new.area, new.priority, new.owner, new.due_date, new.position, new.why, new.responsable)
       is distinct from
       (old.title, old.org_id, old.call_id, old.parent_id, old.area, old.priority, old.owner, old.due_date, old.position, old.why, old.responsable) then
      raise exception 'Solo podés marcar accionables como completados';
    end if;
  end if;
  new.done_at := case when new.done and not old.done then now() when not new.done then null else old.done_at end;
  return new;
end $$;
