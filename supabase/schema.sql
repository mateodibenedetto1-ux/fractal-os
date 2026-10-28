-- ============================================================
-- FRACTAL OS — esquema de base de datos (Supabase / Postgres)
-- Pegá este archivo completo en Supabase → SQL Editor → Run.
-- Es idempotente: se puede volver a correr sin romper nada.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Cuentas ----------
-- Una "organización" es una cuenta. Fractal es la cuenta principal (kind = 'agency')
-- y cada cliente es una subcuenta (kind = 'client') con parent_id = Fractal.
create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references organizations(id) on delete cascade,
  kind          text not null default 'client' check (kind in ('agency','client')),
  name          text not null,
  slug          text not null unique,
  status        text not null default 'activo' check (status in ('onboarding','activo','pausado','finalizado')),
  offer         text,                       -- Consultoría, B2B, Contenido…
  program_month int,                        -- Mes 1..6
  start_date    date,
  next_step     text,
  contact_name  text,
  contact_email text,
  email_domains text[] not null default '{}', -- dominios/emails para asignar llamadas de Fathom automáticamente
  drive_url     text,
  tracker_url   text,
  program_url   text,
  notion_url    text,
  accent        text,                       -- color opcional del portal
  created_at    timestamptz not null default now()
);

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references organizations(id) on delete cascade,
  role       text not null default 'client' check (role in ('owner','admin','member','client')),
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

-- ---------- Llamadas ----------
create table if not exists calls (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid references organizations(id) on delete cascade, -- null = sin asignar (bandeja)
  title          text not null,
  held_at        timestamptz not null default now(),
  source         text not null default 'manual' check (source in ('fathom','manual','notion')),
  recording_id   bigint unique,
  fathom_url     text,
  share_url      text,
  summary_md     text,
  transcript     jsonb,
  raw            jsonb,
  invitee_emails text[] not null default '{}',
  status         text not null default 'pendiente' check (status in ('pendiente','procesada','error')),
  error          text,
  notion_id      text unique,
  created_at     timestamptz not null default now()
);

-- ---------- Accionables ----------
create table if not exists action_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  call_id       uuid references calls(id) on delete set null,
  parent_id     uuid references action_items(id) on delete cascade,
  title         text not null,
  why           text,             -- el "por qué" del accionable
  area          text,             -- Marketing, Contenido, Comercial, Operaciones…
  priority      text check (priority in ('critica','alta','media','baja')),
  owner         text not null default 'cliente' check (owner in ('cliente','fractal')),
  due_date      date,
  done          boolean not null default false,
  done_at       timestamptz,
  position      int not null default 0,
  source        text not null default 'manual' check (source in ('fathom','manual','notion','ia')),
  notion_id     text unique,
  created_at    timestamptz not null default now()
);

-- ---------- Recursos (links compartidos: docs, sheets, carpetas, videos) ----------
create table if not exists resources (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  call_id     uuid references calls(id) on delete set null,
  title       text not null,
  url         text not null,
  kind        text not null default 'link' check (kind in ('doc','sheet','slides','folder','video','page','link')),
  description text,
  created_at  timestamptz not null default now(),
  unique (org_id, url)
);

-- ---------- Biblioteca (documentos escritos dentro del sistema) ----------
create table if not exists documents (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  call_id    uuid references calls(id) on delete set null,
  title      text not null,
  kind       text not null default 'nota' check (kind in ('resumen','sop','estrategia','diagnostico','nota')),
  body_md    text not null default '',
  visible_to_client boolean not null default true,
  notion_id  text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Roadmap (hitos) ----------
create table if not exists milestones (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  title      text not null,
  detail     text,
  due_date   date,
  status     text not null default 'pendiente' check (status in ('pendiente','en_curso','listo')),
  position   int not null default 0,
  notion_id  text unique,
  created_at timestamptz not null default now()
);

-- ---------- Integraciones: un webhook de Fathom por persona del equipo ----------
create table if not exists fathom_connections (
  id             uuid primary key default gen_random_uuid(),
  label          text not null,
  webhook_secret text,                 -- whsec_… que da Fathom al crear el webhook
  last_event_at  timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists action_items_org_idx on action_items(org_id, done);
create index if not exists calls_org_idx on calls(org_id, held_at desc);
create index if not exists resources_org_idx on resources(org_id);
create index if not exists documents_org_idx on documents(org_id);

-- ============================================================
-- Permisos (Row Level Security)
-- Staff de Fractal (miembros de la cuenta 'agency') ve y edita todo.
-- Un cliente solo ve su propia subcuenta y solo puede marcar accionables.
-- ============================================================

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m join organizations o on o.id = m.org_id
    where m.user_id = auth.uid() and o.kind = 'agency' and m.role in ('owner','admin','member')
  );
$$;

create or replace function can_see_org(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_staff() or exists (
    select 1 from memberships m where m.user_id = auth.uid() and m.org_id = target
  );
$$;

alter table organizations      enable row level security;
alter table profiles           enable row level security;
alter table memberships        enable row level security;
alter table calls              enable row level security;
alter table action_items       enable row level security;
alter table resources          enable row level security;
alter table documents          enable row level security;
alter table milestones         enable row level security;
alter table fathom_connections enable row level security;

do $$ declare t text; begin
  foreach t in array array['organizations','profiles','memberships','calls','action_items','resources','documents','milestones','fathom_connections'] loop
    execute format('drop policy if exists staff_all on %I', t);
    execute format('create policy staff_all on %I for all using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

drop policy if exists client_read on organizations;
create policy client_read on organizations for select using (can_see_org(id));

drop policy if exists self_read on profiles;
create policy self_read on profiles for select using (id = auth.uid());

drop policy if exists self_read on memberships;
create policy self_read on memberships for select using (user_id = auth.uid());

drop policy if exists client_read on calls;
create policy client_read on calls for select using (org_id is not null and can_see_org(org_id));

drop policy if exists client_read on action_items;
create policy client_read on action_items for select using (can_see_org(org_id));
drop policy if exists client_check on action_items;
create policy client_check on action_items for update using (can_see_org(org_id)) with check (can_see_org(org_id));

drop policy if exists client_read on resources;
create policy client_read on resources for select using (can_see_org(org_id));

drop policy if exists client_read on documents;
create policy client_read on documents for select using (can_see_org(org_id) and (visible_to_client or is_staff()));

drop policy if exists client_read on milestones;
create policy client_read on milestones for select using (can_see_org(org_id));

-- El cliente solo puede tocar "done" en sus accionables; el resto de columnas queda bloqueado.
create or replace function guard_client_action_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_staff() then
    if (new.title, new.org_id, new.call_id, new.parent_id, new.area, new.priority, new.owner, new.due_date, new.position, new.why)
       is distinct from
       (old.title, old.org_id, old.call_id, old.parent_id, old.area, old.priority, old.owner, old.due_date, old.position, old.why) then
      raise exception 'Solo podés marcar accionables como completados';
    end if;
  end if;
  new.done_at := case when new.done and not old.done then now() when not new.done then null else old.done_at end;
  return new;
end $$;

drop trigger if exists action_items_guard on action_items;
create trigger action_items_guard before update on action_items
  for each row execute function guard_client_action_update();

-- Perfil automático al crear un usuario
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Cuenta principal de Fractal
-- ============================================================
insert into organizations (kind, name, slug)
values ('agency', 'Fractal', 'fractal')
on conflict (slug) do nothing;

-- Después de crear tu usuario (registrándote en /login), corré esto
-- reemplazando el email para hacerte dueño de Fractal:
--
-- insert into memberships (user_id, org_id, role)
-- select u.id, o.id, 'owner' from auth.users u, organizations o
-- where u.email = 'TU_EMAIL@gmail.com' and o.slug = 'fractal'
-- on conflict do nothing;
