-- 009: roadmap personalizado con IA cuando el cliente completa su Segundo cerebro
alter table client_brain add column if not exists roadmap_status text;   -- generando | listo | error
alter table client_brain add column if not exists roadmap_at timestamptz;
alter table client_brain add column if not exists roadmap_error text;
alter table milestones add column if not exists source text;             -- 'ia' = hito del roadmap personalizado
alter table action_items drop constraint if exists action_items_source_check;
alter table action_items add constraint action_items_source_check check (source in ('fathom','manual','notion','ia','recorrido','roadmap'));
