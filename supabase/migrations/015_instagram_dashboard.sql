-- 015 · Dashboard tipo Instagram: seguidores ganados por día, reposts y resumen por período
alter table ig_daily add column if not exists new_followers int;
alter table ig_media add column if not exists reposts int;
alter table ig_accounts add column if not exists summary jsonb;
