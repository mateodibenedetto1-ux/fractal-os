import 'server-only';
import { supabaseServer } from './supabase/server';
import { BRAIN, MODULES, sectionPct, type BrainData } from './brain';
import { leadShort } from './journey';
import type { Org } from './types';

export interface StageTask { id: string; title: string; done: boolean; owner: string; due_date: string | null; source: string; why: string | null }
export interface Stage {
  k: string; n: string; title: string; about: string; lead: string;
  start: string; end: string; state: 'done' | 'now' | 'locked';
  objective: string | null;
  sections: { k: string; n: number; title: string; pct: number }[];
  hitos: { id: string; title: string; date: string | null; detail: string | null }[];
  tasks: StageTask[];
}
export interface JourneyView { stages: Stage[]; week: number; totalWeeks: number; pct: number; current: string | null; docId: string | null; classesUrl: string | null }

const DAY = 864e5;
const t = (s: string) => new Date(s + 'T12:00:00').getTime();

/** Arma el recorrido por etapas (módulos) con todo lo de cada una. Null si el cliente no tiene recorrido. */
export async function getJourneyView(org: Org): Promise<JourneyView | null> {
  const sb = await supabaseServer();
  const [{ data: ms }, { data: acts }, { data: brain }, { data: doc }] = await Promise.all([
    sb.from('milestones').select('id, title, detail, due_date, kind, brain_section, source, module').eq('org_id', org.id).order('due_date'),
    sb.from('action_items').select('id, title, done, owner, due_date, source, why, module, brain_section').eq('org_id', org.id).is('parent_id', null).in('source', ['recorrido', 'roadmap']).order('due_date').order('position'),
    sb.from('client_brain').select('data').eq('org_id', org.id).maybeSingle(),
    sb.from('documents').select('id').eq('org_id', org.id).eq('kind', 'estrategia').like('title', 'Tu roadmap personalizado%').order('created_at', { ascending: false }).limit(1),
  ]);
  const phases = (ms ?? []).filter((m) => m.kind === 'fase' && MODULES.some((x) => x.k === m.brain_section));
  if (!phases.length) return null;
  const data = (brain?.data ?? {}) as BrainData;
  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

  const stages: Stage[] = MODULES.map((m, i) => {
    const ph = phases.find((p) => p.brain_section === m.k);
    const start = ph?.due_date ?? today;
    const next = phases.find((p) => p.brain_section === MODULES[i + 1]?.k)?.due_date;
    const end = next ? new Date(t(next) - DAY).toISOString().slice(0, 10) : new Date(t(start) + (m.weeks * 7 - 1) * DAY).toISOString().slice(0, 10);
    const inWin = (d: string | null) => Boolean(d && d >= start && d <= end);
    const state: Stage['state'] = start > today ? 'locked' : end < today ? 'done' : 'now';
    return {
      k: m.k, n: m.n, title: m.title, about: m.about, lead: leadShort(m.lead), start, end, state,
      objective: ph?.detail ?? null,
      sections: BRAIN.filter((s) => s.mod === m.k).map((s) => ({ k: s.k, n: s.n, title: s.title, pct: sectionPct(data, s) })),
      hitos: (ms ?? []).filter((x) => x.kind !== 'fase' && x.brain_section !== 'cierre' && (x.module ? x.module === m.k : x.source === 'ia' && inWin(x.due_date)))
        .map((x) => ({ id: x.id, title: x.title, date: x.due_date, detail: x.detail })),
      tasks: (acts ?? []).filter((a) => (a.module ? a.module === m.k : inWin(a.due_date)))
        .map((a) => ({ id: a.id, title: a.title, done: a.done, owner: a.owner, due_date: a.due_date, source: a.source, why: a.why })),
    };
  });

  const s0 = t(stages[0].start);
  const e0 = t(stages[stages.length - 1].end);
  const now = t(today);
  return {
    stages,
    week: Math.max(1, Math.min(Math.ceil((e0 - s0 + DAY) / (7 * DAY)), Math.floor((now - s0) / (7 * DAY)) + 1)),
    totalWeeks: Math.ceil((e0 - s0 + DAY) / (7 * DAY)),
    pct: Math.max(0, Math.min(100, ((now - s0) / Math.max(DAY, e0 - s0)) * 100)),
    current: stages.find((s) => s.state === 'now')?.k ?? (stages.every((s) => s.state === 'done') ? stages[stages.length - 1].k : stages[0].k),
    docId: doc?.[0]?.id ?? null,
    classesUrl: org.program_url ?? null,
  };
}
