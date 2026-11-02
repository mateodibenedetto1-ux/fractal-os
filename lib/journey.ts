import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BRAIN, MODULES } from './brain';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 864e5;

export interface StageWindow { k: string; n: string; title: string; lead: string; start: string; end: string; startWeek: number; endWeek: number }

/** Fechas de cada etapa (módulo) desde el inicio del recorrido. */
export function stageWindows(start: string): StageWindow[] {
  let cursor = new Date(start + 'T12:00:00').getTime();
  let week = 1;
  return MODULES.map((m) => {
    const s = cursor;
    const e = s + (m.weeks * 7 - 1) * DAY;
    const w = { k: m.k, n: m.n, title: m.title, lead: m.lead, start: iso(new Date(s)), end: iso(new Date(e)), startWeek: week, endWeek: week + m.weeks - 1 };
    cursor = e + DAY;
    week += m.weeks;
    return w;
  });
}

export const leadShort = (lead: string) => (lead === 'Lorena' ? 'Lore' : lead === 'Mateo' ? 'Mateo' : 'Mateo y Lore');

/** Crea el Recorrido Fractal: una etapa por módulo (con sus tareas base) y el cierre. Reemplaza uno anterior. */
export async function buildJourney(sb: SupabaseClient, orgId: string, start: string, programUrl: string | null) {
  await sb.from('action_items').delete().eq('org_id', orgId).eq('source', 'recorrido');
  await sb.from('milestones').delete().eq('org_id', orgId).not('brain_section', 'is', null);
  const wins = stageWindows(start);
  let pos = 0;
  for (const w of wins) {
    const m = MODULES.find((x) => x.k === w.k)!;
    const lead = leadShort(m.lead);
    const ms = await sb.from('milestones').insert({
      org_id: orgId, title: `Módulo ${m.n} — ${m.title}`, detail: `${m.about} Lo guía ${lead}.`, due_date: w.start, kind: 'fase', position: Number(m.n), brain_section: m.k, module: m.k,
    });
    if (ms.error) throw new Error(ms.error.message);
    const rows = [
      { org_id: orgId, title: `Ver las clases del módulo ${m.n} · ${m.title}`, why: programUrl ? `En Skool: ${programUrl}` : 'Las clases de este módulo están en Skool.', owner: 'cliente', due_date: w.end, position: pos++, source: 'recorrido', brain_section: null as string | null, module: m.k },
      ...BRAIN.filter((s) => s.mod === m.k).map((s) => ({
        org_id: orgId, title: `Completar ${s.title} en tu Segundo cerebro`, why: 'Se tilda sola cuando la sección llega al 80 %.', owner: 'cliente', due_date: w.end, position: pos++, source: 'recorrido', brain_section: s.k, module: m.k,
      })),
      { org_id: orgId, title: `Revisar ${m.title} con ${lead} en la llamada`, why: 'Ajustamos juntos lo que completaste y definimos el próximo paso.', owner: 'fractal', due_date: w.end, position: pos++, source: 'recorrido', brain_section: null, module: m.k },
    ];
    const t = await sb.from('action_items').insert(rows);
    if (t.error) throw new Error(t.error.message);
  }
  const last = wins[wins.length - 1];
  await sb.from('milestones').insert({
    org_id: orgId, title: 'Cierre de Fractal Consulting', detail: 'Revisión final de los 9 módulos y próximos pasos.', due_date: last.end, kind: 'hito', position: 99, brain_section: 'cierre',
  });
}

/** Inicio del recorrido: la primera etapa creada, o la fecha de inicio del cliente, o hoy. */
export async function journeyStart(sb: SupabaseClient, orgId: string, fallback: string | null) {
  const { data } = await sb.from('milestones').select('due_date').eq('org_id', orgId).eq('kind', 'fase').not('brain_section', 'is', null).order('due_date').limit(1);
  return { start: data?.[0]?.due_date ?? fallback ?? iso(new Date(Date.now() - 3 * 3600e3)), exists: Boolean(data?.length) };
}
