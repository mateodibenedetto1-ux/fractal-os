import type { Milestone } from './types';

export type RoadmapStatus = 'pendiente' | 'en_curso' | 'listo';

export interface RoadmapItem extends Milestone {
  derived: RoadmapStatus;
  kindResolved: 'fase' | 'hito';
  end: string | null; // fin del rango (para fases): día antes de la fase siguiente
  soon: boolean; // hito dentro de los próximos 7 días
}

export interface RoadmapView {
  items: RoadmapItem[];
  phases: RoadmapItem[];
  milestones: RoadmapItem[];
  current: RoadmapItem | null;
  next: RoadmapItem | null;
  start: string | null;
  end: string | null;
  pct: number;
  week: number;
  totalWeeks: number;
}

const DAY = 864e5;
const d = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00');
const iso = (date: Date) => date.toISOString().slice(0, 10);

export function isPhase(m: Pick<Milestone, 'title' | 'kind'>) {
  if (m.kind) return m.kind === 'fase';
  return /^fase\b/i.test(m.title.trim());
}

/**
 * Calcula el estado de cada hito según la fecha de hoy, para que el roadmap avance solo
 * aunque nadie lo actualice a mano. Si un hito tiene auto_status = false, se respeta su estado.
 */
export function computeRoadmap(list: Milestone[], programStart: string | null, today = new Date()): RoadmapView {
  const t = d(iso(today)).getTime();
  const dated = list.filter((m) => m.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const undated = list.filter((m) => !m.due_date);

  const phases = dated.filter(isPhase);
  const phaseItems: RoadmapItem[] = phases.map((p, i) => {
    const startT = d(p.due_date!).getTime();
    const next = phases[i + 1];
    const endT = next ? d(next.due_date!).getTime() - DAY : null;
    let derived: RoadmapStatus = 'pendiente';
    if (startT <= t) derived = endT !== null && endT < t ? 'listo' : 'en_curso';
    return { ...p, kindResolved: 'fase', end: endT ? iso(new Date(endT)) : null, soon: false, derived: p.auto_status === false ? p.status : derived };
  });

  const hitoItems: RoadmapItem[] = dated.filter((m) => !isPhase(m)).map((m) => {
    const at = d(m.due_date!).getTime();
    const derived: RoadmapStatus = at < t ? 'listo' : at === t ? 'en_curso' : 'pendiente';
    return { ...m, kindResolved: 'hito', end: null, soon: at >= t && at - t <= 7 * DAY, derived: m.auto_status === false ? m.status : derived };
  });

  const items = [...phaseItems, ...hitoItems, ...undated.map((m) => ({ ...m, kindResolved: (isPhase(m) ? 'fase' : 'hito') as 'fase' | 'hito', end: null, soon: false, derived: m.status }))]
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || (a.kindResolved === 'fase' ? -1 : 1));

  const start = programStart ?? dated[0]?.due_date ?? null;
  const lastPhase = phaseItems[phaseItems.length - 1];
  // Fin estimado: la última fecha del roadmap (una fase abierta se cuenta con 30 días)
  const lastDate = dated[dated.length - 1]?.due_date ?? null;
  const endT = lastDate
    ? Math.max(d(lastDate).getTime(), lastPhase && lastPhase.due_date === lastDate ? d(lastDate).getTime() + 30 * DAY : 0)
    : null;
  const end = endT ? iso(new Date(endT)) : null;

  let pct = 0;
  let week = 0;
  let totalWeeks = 0;
  if (start && endT) {
    const s = d(start).getTime();
    pct = Math.max(0, Math.min(100, ((t - s) / Math.max(DAY, endT - s)) * 100));
    week = Math.max(1, Math.floor((t - s) / (7 * DAY)) + 1);
    totalWeeks = Math.max(week, Math.ceil((endT - s) / (7 * DAY)));
  }

  const current = phaseItems.filter((p) => p.derived === 'en_curso').pop() ?? null;
  const next = items.find((m) => m.derived === 'pendiente') ?? null;
  return { items, phases: phaseItems, milestones: hitoItems, current, next, start, end, pct, week, totalWeeks };
}
