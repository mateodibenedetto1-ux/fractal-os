-- 016 · Varias cuentas de Instagram por cliente (ej. Brainzeed + Marcela)
alter table ig_accounts drop constraint if exists ig_accounts_pkey;
alter table ig_accounts add primary key (org_id, ig_user_id);

alter table ig_media add column if not exists ig_user_id text;
update ig_media m set ig_user_id = a.ig_user_id from ig_accounts a where a.org_id = m.org_id and m.ig_user_id is null;
create index if not exists ig_media_acc_idx on ig_media (org_id, ig_user_id, posted_at desc);

alter table ig_daily add column if not exists ig_user_id text;
update ig_daily d set ig_user_id = a.ig_user_id from ig_accounts a where a.org_id = d.org_id and d.ig_user_id is null;
update ig_daily set ig_user_id = '' where ig_user_id is null;
alter table ig_daily alter column ig_user_id set not null;
alter table ig_daily drop constraint if exists ig_daily_pkey;
alter table ig_daily add primary key (org_id, ig_user_id, day);
