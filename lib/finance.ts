import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from './supabase/admin';

/**
 * Finanzas del negocio Fractal. Es un espejo de "Tabla de Finanzas FRACTAL": cada mes se cargan en las dos
 * los movimientos del negocio (ingresos y gastos con Quién = Negocio). Lo personal queda solo en la planilla.
 */

export const FINANCE_TAG = 'finance';
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Solo Mateo y Lorena (se puede cambiar con FINANCE_EMAILS, separados por coma). */
export function canSeeFinance(email: string | null | undefined) {
  const list = (process.env.FINANCE_EMAILS ?? 'mateo.dibenedetto1@gmail.com,lorenamarkotich8@gmail.com')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return Boolean(email) && list.includes(email!.toLowerCase());
}

export interface Income { date: string | null; client: string; billed: number; cash: number; tag: string; pending: boolean }
export interface Expense { date: string | null; detail: string; category: 'Equipo' | 'Software' | 'Comisiones' | 'Otros'; amount: number }
export interface Month {
  key: string; // 2026-10
  label: string; // Oct
  name: string; // Octubre 2026
  tab: string | null;
  billed: number; cash: number; pending: number;
  team: number; software: number; fees: number; other: number; direct: number;
  profit: number; margin: number | null; pettyCash: number; distributable: number;
  incomes: Income[]; expenses: Expense[];
}
export interface ClientTotal { name: string; billed: number; cash: number; pending: number; tag: string; months: number }
export interface FinanceData {
  months: Month[];
  totals: { billed: number; cash: number; pending: number; direct: number; profit: number; distributable: number; team: number; software: number; fees: number; other: number; margin: number | null };
  quarters: { q: string; billed: number; cash: number; direct: number; profit: number; distributable: number; months: number }[];
  clients: ClientTotal[];
  topSoftware: { name: string; amount: number }[];
  pettyPct: number;
  year: number;
  sheetUrl: string | null;
  updatedAt: string;
}

const round = (n: number) => Math.round(n * 100) / 100;


/** Mismo cliente con otro nombre en la planilla. */
const CLIENT_ALIASES: Record<string, string> = { marcela: 'Brainzeed', 'marcela pezet': 'Brainzeed' };
/** Mismo software con otro nombre. */
const SOFTWARE_ALIASES: Record<string, string> = { 'notion labs': 'Notion', manychat: 'ManyChat', 'chat gpt': 'OpenAI', chatgpt: 'OpenAI' };

/** "Andy & Exe (pago 1 de 2)" → "Andy & Exe" */
const clientName = (s: string) => {
  const n = s.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return CLIENT_ALIASES[n.toLowerCase()] ?? n;
};

function category(tag: string): Expense['category'] {
  const t = tag.toLowerCase();
  if (t === 'equipo' || t === 'trabajo') return 'Equipo';
  if (t === 'software') return 'Software';
  if (t.startsWith('comisi')) return 'Comisiones';
  return 'Otros';
}

export function tabFor(year: number, month: number) {
  return `${MONTHS[month]}-${String(year).slice(2)}`;
}


type Row = { month: string; kind: 'ingreso' | 'gasto'; date: string | null; detail: string; billed: number | string; cash: number | string | null; amount: number | string; tag: string | null };

async function load(): Promise<FinanceData> {
  const sb = supabaseAdmin();
  const [{ data: rows, error }, { data: cfg }] = await Promise.all([
    sb.from('finance_movements').select('month, kind, date, detail, billed, cash, amount, tag').order('position'),
    sb.from('finance_settings').select('petty_pct, sheet_url').eq('id', 1).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  const pettyPct = Number(cfg?.petty_pct ?? 0.1);
  const all = (rows ?? []) as Row[];
  const year = Math.max(new Date().getFullYear() - (all.length ? 0 : 0), ...all.map((r) => Number(r.month.slice(0, 4))));
  const ofYear = all.filter((r) => Number(r.month.slice(0, 4)) === year);

  const byMonth = new Map<number, Month>();
  const monthsWithData = [...new Set(ofYear.map((r) => Number(r.month.slice(5)) - 1))];
  for (const m of monthsWithData) {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`;
    const list = ofYear.filter((r) => r.month === key);
    const incomes: Income[] = list.filter((r) => r.kind === 'ingreso').map((r) => ({
      date: r.date, client: clientName(r.detail), billed: Number(r.billed), cash: Number(r.cash ?? 0), tag: r.tag || '—',
      pending: Number(r.billed) > 0 && r.cash == null,
    }));
    const expenses: Expense[] = list.filter((r) => r.kind === 'gasto').map((r) => ({
      date: r.date, detail: r.detail, category: category(r.tag ?? ''), amount: Number(r.amount),
    }));
    byMonth.set(m, build(year, m, tabFor(year, m), incomes, expenses, pettyPct));
  }

  // Meses continuos desde el primero con pestaña hasta el último (los que faltan quedan vacíos)
  const keys = [...byMonth.keys()];
  const months: Month[] = [];
  if (keys.length) for (let m = Math.min(...keys); m <= Math.max(...keys); m++) months.push(byMonth.get(m) ?? build(year, m, null, [], [], pettyPct));

  const sum = (f: (m: Month) => number, list = months) => round(list.reduce((s, m) => s + f(m), 0));
  const totals = {
    billed: sum((m) => m.billed), cash: sum((m) => m.cash), pending: sum((m) => m.pending), direct: sum((m) => m.direct),
    profit: sum((m) => m.profit), distributable: sum((m) => m.distributable),
    team: sum((m) => m.team), software: sum((m) => m.software), fees: sum((m) => m.fees), other: sum((m) => m.other),
    margin: null as number | null,
  };
  totals.margin = totals.cash ? totals.profit / totals.cash : null;

  const quarters = [0, 1, 2, 3].map((qi) => {
    const list = months.filter((m) => Math.floor((Number(m.key.slice(5)) - 1) / 3) === qi);
    return { q: `Q${qi + 1}`, billed: sum((m) => m.billed, list), cash: sum((m) => m.cash, list), direct: sum((m) => m.direct, list), profit: sum((m) => m.profit, list), distributable: sum((m) => m.distributable, list), months: list.filter((m) => m.tab).length };
  });

  const cm = new Map<string, ClientTotal & { seen: Set<string> }>();
  for (const m of months) for (const inc of m.incomes) {
    const k = inc.client.toLowerCase();
    const c = cm.get(k) ?? { name: inc.client, billed: 0, cash: 0, pending: 0, tag: inc.tag, months: 0, seen: new Set<string>() };
    c.billed += inc.billed; c.cash += inc.cash; if (inc.pending) c.pending += inc.billed; c.seen.add(m.key);
    cm.set(k, c);
  }
  const clients = [...cm.values()].map(({ seen, ...c }) => ({ ...c, billed: round(c.billed), cash: round(c.cash), pending: round(c.pending), months: seen.size }))
    .sort((a, b) => b.billed - a.billed);

  const sw = new Map<string, number>();
  for (const m of months) for (const e of m.expenses) if (e.category === 'Software') {
    const raw = e.detail.replace(/\s+/g, ' ').trim();
    const k = SOFTWARE_ALIASES[raw.toLowerCase()] ?? raw;
    sw.set(k, (sw.get(k) ?? 0) + e.amount);
  }
  const topSoftware = [...sw.entries()].map(([name, amount]) => ({ name, amount: round(amount) })).sort((a, b) => b.amount - a.amount).slice(0, 8);

  return { months, totals, quarters, clients, topSoftware, pettyPct, year, sheetUrl: cfg?.sheet_url ?? null, updatedAt: new Date().toISOString() };
}

function build(year: number, m: number, tab: string | null, incomes: Income[], expenses: Expense[], pettyPct: number): Month {
  const s = (f: (x: Expense) => boolean) => round(expenses.filter(f).reduce((a, e) => a + e.amount, 0));
  const billed = round(incomes.reduce((a, x) => a + x.billed, 0));
  const cash = round(incomes.reduce((a, x) => a + x.cash, 0));
  const pending = round(incomes.filter((x) => x.pending).reduce((a, x) => a + x.billed, 0));
  const team = s((e) => e.category === 'Equipo');
  const software = s((e) => e.category === 'Software');
  const fees = s((e) => e.category === 'Comisiones');
  const other = s((e) => e.category === 'Otros');
  const direct = round(team + software + fees + other);
  const profit = round(cash - direct);
  const pettyCash = profit > 0 ? round(profit * pettyPct) : 0;
  return {
    key: `${year}-${String(m + 1).padStart(2, '0')}`, label: SHORT[m], name: `${MONTHS[m]} ${year}`, tab,
    billed, cash, pending, team, software, fees, other, direct, profit,
    margin: cash ? profit / cash : null, pettyCash, distributable: round(profit - pettyCash),
    incomes, expenses: expenses.sort((a, b) => b.amount - a.amount),
  };
}

export const getFinance = unstable_cache(load, ['finance-data'], { tags: [FINANCE_TAG], revalidate: 300 });

