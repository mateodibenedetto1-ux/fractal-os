import 'server-only';
import { unstable_cache } from 'next/cache';
import { hasNotion, pageTitle, plainId, prop, queryDatabase, val } from './notion';
import { computeRoadmap } from './roadmap';
import type { Call, Milestone, Org } from './types';

export interface ContentItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  formato: string | null;
  plataforma: string | null;
  estado: string | null;
  cuenta: string;
  pilar: string | null;
  entrega: string | null;
  client?: string;
  clientSlug?: string;
}

export interface KeyDate {
  id: string;
  date: string;
  title: string;
  kind: 'fase' | 'hito' | 'llamada';
  client?: string;
  clientSlug?: string;
}

const fetchCalendars = unstable_cache(
  async (calendars: { id: string; label: string }[], from: string) => {
    const out: ContentItem[] = [];
    for (const cal of calendars) {
      const rows = await queryDatabase(cal.id, {
        filter: { property: 'Fecha Posteo', date: { on_or_after: from } },
        sorts: [{ property: 'Fecha Posteo', direction: 'ascending' }],
      });
      for (const r of rows) {
        const date = val(prop(r, 'Fecha Posteo', 'Fecha'));
        if (!date) continue;
        const cuentas: string[] = val(prop(r, 'Cuenta')) ?? [];
        out.push({
          id: plainId(r.id),
          title: pageTitle(r),
          date: String(date).slice(0, 10),
          formato: val(prop(r, 'Formato')),
          plataforma: val(prop(r, 'Plataforma')),
          estado: val(prop(r, 'Estado')),
          cuenta: cuentas.length ? cuentas.join(' · ') : cal.label,
          pilar: val(prop(r, 'Pilar')),
          entrega: val(prop(r, 'Fecha de Entrega'))?.slice(0, 10) ?? null,
        });
      }
    }
    return out;
  },
  ['content-calendar'],
  { revalidate: 300 },
);

/** Contenidos del calendario de Notion del cliente (desde 60 días atrás). */
export async function getContentCalendar(org: Org): Promise<{ items: ContentItem[]; error?: string }> {
  const cals = org.notion_calendars ?? [];
  if (!cals.length) return { items: [] };
  if (!hasNotion()) return { items: [], error: 'Falta conectar Notion.' };
  const from = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  try {
    const items = await fetchCalendars(cals, from);
    return { items: items.map((i) => ({ ...i, client: org.name, clientSlug: org.slug })) };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : 'No se pudo leer el calendario de Notion.' };
  }
}

/** Fechas clave: inicio de fases, hitos del roadmap y llamadas. */
export function keyDatesFor(org: Org, milestones: Milestone[], calls: Pick<Call, 'id' | 'title' | 'held_at'>[]): KeyDate[] {
  const view = computeRoadmap(milestones, org.start_date);
  return [
    ...view.items.filter((m) => m.due_date).map((m) => ({
      id: m.id, date: m.due_date!, title: m.title, kind: m.kindResolved, client: org.name, clientSlug: org.slug,
    })),
    ...calls.map((c) => ({ id: c.id, date: c.held_at.slice(0, 10), title: c.title, kind: 'llamada' as const, client: org.name, clientSlug: org.slug })),
  ];
}
