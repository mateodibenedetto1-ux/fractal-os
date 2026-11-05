-- 013 · Finanzas del negocio (espejo de "Tabla de Finanzas FRACTAL"; lo personal queda solo en la planilla)
create table if not exists finance_movements (
  id         uuid primary key default gen_random_uuid(),
  month      text not null check (month ~ '^\d{4}-\d{2}$'),       -- 2026-10
  kind       text not null check (kind in ('ingreso', 'gasto')),
  date       date,
  detail     text not null,
  billed     numeric(12,2) not null default 0,   -- ingreso: facturado
  cash       numeric(12,2),                       -- ingreso: cobrado (null = pendiente)
  amount     numeric(12,2) not null default 0,   -- gasto: monto
  tag        text,                                -- B2B/B2C o Equipo/Software/Comisiones
  method     text,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists finance_movements_month_idx on finance_movements (month);

create table if not exists finance_settings (
  id         int primary key default 1 check (id = 1),
  petty_pct  numeric(5,4) not null default 0.10,  -- caja chica sobre el profit
  sheet_url  text,
  updated_at timestamptz not null default now()
);
insert into finance_settings (id) values (1) on conflict do nothing;

-- Sin políticas: solo el servidor (service role) lee y escribe. La app además filtra por mail (Mateo y Lorena).
alter table finance_movements enable row level security;
alter table finance_settings enable row level security;
