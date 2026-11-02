-- 006 · Base de Conocimiento de Fractal (bóveda de documentos para la IA). Solo equipo.

create table if not exists kb_documents (
  id          uuid primary key default gen_random_uuid(),
  source_id   text unique,                -- id del archivo en Google Drive
  title       text not null,
  category    text,                       -- Ops, Setting, Closing, Ofertas…
  module      text,                       -- módulo del curso (icp, oferta, brand, …)
  source_url  text,
  kind        text,                       -- doc, sheet, pdf, docx
  content     text,
  chars       int generated always as (coalesce(length(content), 0)) stored,
  summary     text,
  status      text not null default 'ok', -- ok, sin_acceso, sin_texto
  note        text,
  updated_at  timestamptz not null default now()
);
alter table kb_documents enable row level security;
drop policy if exists staff_all on kb_documents;
create policy staff_all on kb_documents for all using (is_staff()) with check (is_staff());

-- Tokens para cargar documentos desde el navegador (se guarda solo el hash)
create table if not exists ingest_tokens (
  token_hash text primary key,
  label      text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table ingest_tokens enable row level security;
