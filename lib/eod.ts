import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase/admin';
import { addDays, mondayOf, todayAR } from './health';

/** Desde cuándo se miden reportes y strikes. */
export const EOD_START = '2026-11-09';

export interface EodKpi { id: string; org_id: string; org: string; name: string; target: number; dailyTarget: number; today: number; owner: string | null }
export interface DailyReport { id: string; day: string; author: string; done: string | null; pending: string | null; blockers: string | null; next_steps: string | null; top_content: string | null; notes: string | null; published: number | null; planned: number | null; updated_at: string }
export interface Strike { id: string; day: string; kind: 'kpi' | 'reporte'; subject: string; org_id: string | null; owner: string | null; reason: string | null; status: 'abierto' | 'cerrado'; measure: string | null; closed_by: string | null; created_at: string }

const isWeekday = (day: string) => { const d = new Date(`${day}T12:00:00Z`).getUTCDay(); return d !== 0 && d !== 6; };
const prevWeekday = (day: string) => { let d = addDays(day, -1); while (!isWeekday(d)) d = addDays(d, -1); return d; };
const short = (day: string) => { const [, m, d] = day.split('-'); return `${Number(d)}/${Number(m)}`; };

/** Meta del día de un KPI diario (la meta semanal repartida en 7 días). */
export const dailyTargetOf = (target: number) => Math.round((target / 7) * 10) / 10;

/** Recalcula el real de la semana de un KPI como suma de sus días. */
export async function recomputeKpi(sb: SupabaseClient, kpiId: string) {
  const { data } = await sb.from('kpi_daily').select('value').eq('kpi_id', kpiId);
  const actual = (data ?? []).reduce((a, r) => a + Number(r.value), 0);
  await sb.from('client_kpis').update({ actual, updated_at: new Date().toISOString() }).eq('id', kpiId);
}

/**
 * Genera strikes de los días ya cerrados (idempotente):
 * - KPI diario por debajo de la meta del día dos días seguidos.
 * - Sin reporte del día dos días hábiles seguidos.
 * Un strike nuevo solo si el día anterior no generó uno para lo mismo (4 días seguidos = 2 strikes).
 */
export async function evaluateStrikes(sb: SupabaseClient, lookback = 4) {
  const today = todayAR();
  const days: string[] = [];
  for (let i = lookback; i >= 1; i--) { const d = addDays(today, -i); if (d > EOD_START) days.push(d); }
  if (!days.length) return;
  const from = addDays(days[0], -1);

  const { data: kpis } = await sb.from('client_kpis').select('id, org_id, name, target, week, owner, daily').eq('daily', true).gte('week', mondayOf(from));
  const ids = (kpis ?? []).map((k) => k.id);
  const { data: vals } = ids.length ? await sb.from('kpi_daily').select('kpi_id, day, value').in('kpi_id', ids).gte('day', from) : { data: [] };
  const { data: existing } = await sb.from('strikes').select('kind, subject, day').gte('day', addDays(from, -1));
  const has = new Set((existing ?? []).map((s) => `${s.kind}|${s.subject}|${s.day}`));
  const { data: orgs } = await sb.from('organizations').select('id, name');
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const rows: Record<string, unknown>[] = [];

  // KPIs: por (cliente, nombre) para cruzar semanas
  const kpiOn = (orgId: string, name: string, day: string) => (kpis ?? []).find((k) => k.org_id === orgId && k.name === name && k.week === mondayOf(day));
  const valueOn = (kpiId: string, day: string) => Number((vals ?? []).find((v) => v.kpi_id === kpiId && v.day === day)?.value ?? 0);
  const subjects = new Map<string, { org_id: string; name: string }>();
  for (const k of kpis ?? []) subjects.set(`${k.org_id}:${k.name}`, { org_id: k.org_id, name: k.name });

  for (const [subject, s] of subjects) {
    for (const day of days) {
      const prev = addDays(day, -1);
      const a = kpiOn(s.org_id, s.name, day);
      const b = kpiOn(s.org_id, s.name, prev);
      if (!a || !b || prev < EOD_START) continue;
      const ta = dailyTargetOf(Number(a.target)), tb = dailyTargetOf(Number(b.target));
      const va = valueOn(a.id, day), vb = valueOn(b.id, prev);
      if (va < ta && vb < tb && !has.has(`kpi|${subject}|${day}`) && !has.has(`kpi|${subject}|${prev}`)) {
        has.add(`kpi|${subject}|${day}`);
        rows.push({ day, kind: 'kpi', subject, org_id: s.org_id, owner: a.owner ?? 'Nacho',
          reason: `${orgName.get(s.org_id) ?? ''} · ${s.name}: ${vb} de ${tb} el ${short(prev)} y ${va} de ${ta} el ${short(day)}.` });
      }
    }
  }

  // Reporte del día: dos días hábiles seguidos sin reporte
  const { data: reps } = await sb.from('daily_reports').select('day').gte('day', addDays(from, -3));
  const reported = new Set((reps ?? []).map((r) => r.day));
  for (const day of days.filter(isWeekday)) {
    const prev = prevWeekday(day);
    if (prev < EOD_START) continue;
    if (!reported.has(day) && !reported.has(prev) && !has.has(`reporte|eod|${day}`) && !has.has(`reporte|eod|${prev}`)) {
      has.add(`reporte|eod|${day}`);
      rows.push({ day, kind: 'reporte', subject: 'eod', owner: 'Nacho', reason: `Sin reporte del día el ${short(prev)} ni el ${short(day)}.` });
    }
  }
  if (rows.length) await sb.from('strikes').upsert(rows, { onConflict: 'kind,subject,day', ignoreDuplicates: true });
}

export async function getEod(day = todayAR()) {
  const sb = supabaseAdmin();
  await evaluateStrikes(sb);
  const week = mondayOf(day);
  const [{ data: kpis }, { data: reports }, { data: strikes }, { data: orgs }] = await Promise.all([
    sb.from('client_kpis').select('id, org_id, name, target, owner, daily, position').eq('week', week).eq('daily', true).order('position'),
    sb.from('daily_reports').select('*').gte('day', addDays(day, -14)).order('day', { ascending: false }),
    sb.from('strikes').select('*').order('day', { ascending: false }).limit(100),
    sb.from('organizations').select('id, name'),
  ]);
  const ids = (kpis ?? []).map((k) => k.id);
  const { data: vals } = ids.length ? await sb.from('kpi_daily').select('kpi_id, value').in('kpi_id', ids).eq('day', day) : { data: [] };
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name as string]));
  const list: EodKpi[] = (kpis ?? []).map((k) => ({
    id: k.id, org_id: k.org_id, org: orgName.get(k.org_id) ?? '', name: k.name, target: Number(k.target), owner: k.owner,
    dailyTarget: dailyTargetOf(Number(k.target)), today: Number((vals ?? []).find((v) => v.kpi_id === k.id)?.value ?? 0),
  }));
  const all = (strikes ?? []) as Strike[];
  const byOwner = new Map<string, { total: number; open: number }>();
  for (const s of all) {
    const o = s.owner ?? 'Equipo';
    const c = byOwner.get(o) ?? { total: 0, open: 0 };
    c.total++; if (s.status === 'abierto') c.open++;
    byOwner.set(o, c);
  }
  return {
    day, kpis: list,
    report: ((reports ?? []) as DailyReport[]).find((r) => r.day === day) ?? null,
    history: (reports ?? []) as DailyReport[],
    strikes: all,
    owners: [...byOwner.entries()].map(([owner, c]) => ({ owner, ...c })),
    orgName: Object.fromEntries(orgName),
  };
}
