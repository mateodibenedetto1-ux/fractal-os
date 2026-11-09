import 'server-only';
import { supabaseAdmin } from './supabase/admin';
import type { ActionItem, Org } from './types';

export type Light = 'verde' | 'amarillo' | 'rojo';
export interface WorkflowStep { dow: number; title: string; side: 'fractal' | 'cliente'; responsable?: string | null }
export interface Kpi { id: string; name: string; target: number; actual: number; daily: boolean; position: number; plan: number; pct: number | null }
export interface HealthRow {
  org: Pick<Org, 'id' | 'name' | 'slug' | 'status' | 'start_date' | 'program_month' | 'vertical'> & { workflow: WorkflowStep[] };
  manual: { color: Light | null; importance: string | null; note: string | null; updated_by: string | null; updated_at: string } | null;
  auto: Light | null;
  autoWhy: string;
  color: Light | null;
  kpis: Kpi[];
  kpiPct: number | null;
  tasks: { open: number; overdue: number; oldOverdue: number; weekTotal: number; weekDone: number; next: Pick<ActionItem, 'id' | 'title' | 'due_date' | 'responsable' | 'priority'>[] };
  stage: { onboarding: boolean; label: string };
  log: { id: string; color: Light | null; note: string | null; author: string | null; created_at: string }[];
}

export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Fecha de hoy en Argentina (YYYY-MM-DD). */
export function todayAR() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
/** Lunes de la semana de una fecha (YYYY-MM-DD). */
export function mondayOf(day = todayAR()) {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Regla de la consultoría: rojo ≤ 80 %, amarillo 81–98 %, verde ≥ 99 % del plan a la fecha. */
export function lightOf(pct: number): Light {
  return pct <= 0.8 ? 'rojo' : pct < 0.99 ? 'amarillo' : 'verde';
}

export function planToDate(k: { target: number; daily: boolean }, today = todayAR()) {
  if (!k.daily) return k.target;
  const elapsed = Math.min(7, Math.max(1, (new Date(`${today}T12:00:00Z`).getTime() - new Date(`${mondayOf(today)}T12:00:00Z`).getTime()) / 864e5 + 1));
  return (k.target * elapsed) / 7;
}

export async function getHealthBoard(): Promise<{ rows: HealthRow[]; week: string; today: string }> {
  const sb = supabaseAdmin();
  const today = todayAR();
  const week = mondayOf(today);
  const { data: orgs } = await sb.from('organizations')
    .select('id, name, slug, status, start_date, program_month, vertical, workflow')
    .eq('kind', 'client').in('status', ['activo', 'onboarding']).order('name');
  const ids = (orgs ?? []).map((o) => o.id);
  if (!ids.length) return { rows: [], week, today };
  const [{ data: health }, { data: logs }, { data: kpis }, { data: tasks }] = await Promise.all([
    sb.from('client_health').select('*').in('org_id', ids),
    sb.from('client_health_log').select('id, org_id, color, note, author, created_at').in('org_id', ids).order('created_at', { ascending: false }).limit(200),
    sb.from('client_kpis').select('*').in('org_id', ids).eq('week', week).order('position').order('updated_at'),
    sb.from('action_items').select('id, org_id, client_org_id, title, due_date, done, responsable, priority, parent_id')
      .or(`org_id.in.(${ids.join(',')}),client_org_id.in.(${ids.join(',')})`).is('parent_id', null),
  ]);
  const weekEnd = addDays(week, 6);

  const rows: HealthRow[] = (orgs ?? []).map((o) => {
    const mine = (tasks ?? []).filter((t) => t.org_id === o.id || t.client_org_id === o.id);
    const open = mine.filter((t) => !t.done);
    const overdue = open.filter((t) => t.due_date && t.due_date < today);
    // Para el color solo cuentan las vencidas de las últimas 2 semanas (las viejas se limpian aparte)
    const recent = overdue.filter((t) => t.due_date! >= addDays(today, -14));
    const inWeek = mine.filter((t) => t.due_date && t.due_date >= week && t.due_date <= weekEnd);
    const ks: Kpi[] = (kpis ?? []).filter((k) => k.org_id === o.id).map((k) => {
      const plan = planToDate({ target: Number(k.target), daily: k.daily }, today);
      return { id: k.id, name: k.name, target: Number(k.target), actual: Number(k.actual), daily: k.daily, position: k.position, plan, pct: plan > 0 ? Number(k.actual) / plan : null };
    });
    const withPct = ks.filter((k) => k.pct != null);
    const kpiPct = withPct.length ? withPct.reduce((a, k) => a + Math.min(1, k.pct!), 0) / withPct.length : null;

    let auto: Light | null = null;
    let autoWhy = 'Sin KPIs ni tareas con fecha esta semana.';
    if (kpiPct != null) {
      auto = lightOf(kpiPct);
      autoWhy = `KPIs al ${Math.round(kpiPct * 100)} % del plan a la fecha.`;
    } else if (inWeek.length || recent.length) {
      auto = recent.length >= 3 ? 'rojo' : recent.length ? 'amarillo' : 'verde';
      autoWhy = recent.length ? `${recent.length} ${recent.length === 1 ? 'tarea vencida' : 'tareas vencidas'} en las últimas 2 semanas.` : 'Tareas al día.';
    }
    if (auto === 'verde' && recent.length >= 3) { auto = 'amarillo'; autoWhy += ` Ojo: ${recent.length} tareas vencidas en las últimas 2 semanas.`; }

    const h = (health ?? []).find((x) => x.org_id === o.id) ?? null;
    const months = o.program_month ?? (o.start_date ? Math.floor((Date.now() - new Date(o.start_date).getTime()) / (30.4 * 864e5)) + 1 : null);
    // Onboarding solo si el cliente está marcado así; el resto está en servicio
    const onboarding = o.status === 'onboarding';
    const next = open
      .filter((t) => !t.due_date || t.due_date >= addDays(today, -14))
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
      .slice(0, 4)
      .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, responsable: t.responsable, priority: t.priority }));

    return {
      org: { ...o, workflow: (o.workflow ?? []) as WorkflowStep[] },
      manual: h,
      auto, autoWhy,
      color: (h?.color as Light | null) ?? auto,
      kpis: ks, kpiPct,
      tasks: { open: open.length, overdue: recent.length, oldOverdue: overdue.length - recent.length, weekTotal: inWeek.length, weekDone: inWeek.filter((t) => t.done).length, next },
      stage: { onboarding, label: onboarding ? `Onboarding${months ? ` · mes ${months}` : ''}` : `En servicio${months ? ` · mes ${months}` : ''}` },
      log: (logs ?? []).filter((l) => l.org_id === o.id).slice(0, 4),
    };
  });

  // Prioridad de la daily: rojos, después onboarding, después amarillos y verdes
  const rank = (r: HealthRow) => (r.color === 'rojo' ? 0 : r.stage.onboarding ? 1 : r.color === 'amarillo' ? 2 : r.color == null ? 3 : 4);
  const imp = (r: HealthRow) => (r.manual?.importance === 'alta' ? 0 : r.manual?.importance === 'media' ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || imp(a) - imp(b) || a.org.name.localeCompare(b.org.name));
  return { rows, week, today };
}
