-- 010: cada hito y tarea del roadmap personalizado sabe a qué etapa (módulo) pertenece
alter table milestones add column if not exists module text;
alter table action_items add column if not exists module text;
