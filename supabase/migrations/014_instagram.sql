-- 014 · Laboratorio de contenido: Instagram conectado por cliente
create table if not exists ig_accounts (
  org_id          uuid primary key references organizations(id) on delete cascade,
  ig_user_id      text not null,
  username        text,
  name            text,
  picture         text,
  account_type    text,
  followers       int,
  follows         int,
  media_count     int,
  token           text not null,          -- cifrado (lib/secrets)
  token_expires_at timestamptz,
  connected_by    uuid,
  connected_at    timestamptz not null default now(),
  last_sync_at    timestamptz,
  last_error      text
);

create table if not exists ig_media (
  id              text primary key,       -- id de Instagram
  org_id          uuid not null references organizations(id) on delete cascade,
  caption         text,
  media_type      text,                   -- IMAGE / VIDEO / CAROUSEL_ALBUM
  product_type    text,                   -- FEED / REELS / STORY
  permalink       text,
  thumbnail       text,
  posted_at       timestamptz,
  views           int, reach int, likes int, comments int, saved int, shares int,
  interactions    int, follows int, profile_visits int,
  avg_watch_ms    int,
  updated_at      timestamptz not null default now()
);
create index if not exists ig_media_org_idx on ig_media (org_id, posted_at desc);

-- Foto de cada pieza en el tiempo, para ver cómo crece
create table if not exists ig_media_snapshots (
  media_id  text not null references ig_media(id) on delete cascade,
  at        timestamptz not null default now(),
  views int, reach int, interactions int, follows int,
  primary key (media_id, at)
);

-- Una fila por día y cuenta (seguidores los guardamos nosotros: Instagram no da el histórico)
create table if not exists ig_daily (
  org_id     uuid not null references organizations(id) on delete cascade,
  day        date not null,
  followers  int,
  reach int, views int, engaged int, interactions int, profile_views int,
  primary key (org_id, day)
);

alter table ig_accounts enable row level security;
alter table ig_media enable row level security;
alter table ig_media_snapshots enable row level security;
alter table ig_daily enable row level security;

-- Lectura: el equipo y la gente del cliente (el token nunca se lee desde el cliente: la app usa el service role)
drop policy if exists ig_media_read on ig_media;
create policy ig_media_read on ig_media for select using (can_see_org(org_id));
drop policy if exists ig_daily_read on ig_daily;
create policy ig_daily_read on ig_daily for select using (can_see_org(org_id));
drop policy if exists ig_snap_read on ig_media_snapshots;
create policy ig_snap_read on ig_media_snapshots for select using (exists (select 1 from ig_media m where m.id = media_id and can_see_org(m.org_id)));
