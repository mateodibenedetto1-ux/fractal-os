-- 011: cada reunión del equipo queda también en "Llamadas del equipo" (Notion · Fulfillment)
alter table calls add column if not exists notion_page text;
