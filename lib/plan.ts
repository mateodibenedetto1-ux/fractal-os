import 'server-only';
import { supabaseServer } from './supabase/server';
import { brandOf, type Brand } from './brands';

export interface PlanTask {
  id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  priority: string | null;
  responsable: string | null;
  brand: Brand;
  where: string; // "Tracker" o el nombre del cliente
  href: string;
}

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (s: string, n: number) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
/** Lunes de la semana de una fecha (YYYY-MM-DD). */
export function mondayOf(s: string) {
  const d = new Date(s + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}
export const todayISO = () => iso(new Date(Date.now() - 3 * 3600e3)); // hora de Buenos Aires

type Row = {
  id: string; title: string; done: boolean; due_date: string | null; priority: string | null; responsable: string | null;
  owner: string; client_org_id: string | null; org: { name: string; slug: string; kind: string } | null;
};

/**
 * Tareas en las que está Fractal: el tracker interno y, en cada cliente, las que lleva Fractal.
 * Devuelve las que vencen entre `from` y `to`, las atrasadas abiertas y las abiertas sin fecha.
 */
export async function getPlanTasks(from: string, to: string) {
  const sb = await supabaseServer();
  const sel = 'id, title, done, due_date, priority, responsable, owner, client_org_id, org:organizations!action_items_org_id_fkey(name, slug, kind)';
  const [inRange, overdue, undated, clients] = await Promise.all([
    sb.from('action_items').select(sel).is('parent_id', null).gte('due_date', from).lte('due_date', to).order('due_date'),
    sb.from('action_items').select(sel).is('parent_id', null).eq('done', false).lt('due_date', from).order('due_date', { ascending: false }).limit(200),
    sb.from('action_items').select(sel).is('parent_id', null).eq('done', false).is('due_date', null).limit(200),
    sb.from('organizations').select('id, name, slug').eq('kind', 'client'),
  ]);
  const clientById = new Map((clients.data ?? []).map((c) => [c.id, c]));
  const ours = (r: Row) => r.org?.kind === 'agency' || r.owner === 'fractal' || r.responsable === 'Fractal';
  const map = (r: Row): PlanTask => {
    const agency = r.org?.kind === 'agency';
    const client = agency && r.client_org_id ? clientById.get(r.client_org_id) : null;
    return {
      id: r.id, title: r.title, done: r.done, due_date: r.due_date, priority: r.priority, responsable: r.responsable,
      brand: brandOf({ title: r.title, orgSlug: agency ? null : r.org?.slug, clientSlug: client?.slug ?? null }),
      where: agency ? (client ? `Tracker · ${client.name}` : 'Tracker') : r.org?.name ?? '',
      href: agency ? '/panel/tareas' : `/panel/clientes/${r.org?.slug}/accionables`,
    };
  };
  const pick = (d: { data: unknown }) => ((d.data ?? []) as Row[]).filter(ours).map(map);
  return { tasks: pick(inRange), overdue: pick(overdue), undated: pick(undated) };
}
