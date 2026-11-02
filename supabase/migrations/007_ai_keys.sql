-- 007: API key de Anthropic propia de cada cliente de consultoría (cifrada; solo la lee el servidor)
create table if not exists ai_keys (
  org_id uuid primary key references organizations(id) on delete cascade,
  provider text not null default 'anthropic',
  key_enc text not null,
  key_hint text,
  verified_at timestamptz,
  updated_at timestamptz default now(),
  updated_by uuid
);
alter table ai_keys enable row level security;
-- Sin policies: solo el service role (servidor) puede leer o escribir.
