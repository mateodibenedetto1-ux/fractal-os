/** Tipos de reunión interna del equipo de Fractal. */
export const TEAM_KINDS = [
  { k: 'daily', l: 'Daily' },
  { k: 'creativity', l: 'Creativity Core' },
  { k: 'editores', l: 'Editores' },
  { k: 'equipo', l: 'Equipo' },
] as const;

export type TeamKind = (typeof TEAM_KINDS)[number]['k'];
export interface TeamTitleRule { pattern: string; kind: TeamKind }

export const teamLabel = (k: string | null | undefined) => TEAM_KINDS.find((t) => t.k === k)?.l ?? 'Equipo';

/** "Daily Nacho 30/10" → "daily nacho" (para recordar el título sin fechas ni números). */
export const titleKey = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\d+([/.-]\d+)*/g, ' ').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Tipo sugerido por el título (solo para preseleccionar; no asigna sola). */
export function guessTeamKind(title: string): TeamKind | null {
  const t = titleKey(title);
  if (/\bdaily\b/.test(t)) return 'daily';
  if (/creativ/.test(t)) return 'creativity';
  if (/editor|edicion/.test(t)) return 'editores';
  if (/\b(team|equipo|weekly fractal|interna?)\b/.test(t)) return 'equipo';
  return null;
}

/** Regla guardada con "Recordar": si el título coincide, la llamada va al equipo sola. */
export function matchTeamRule(rules: TeamTitleRule[], title: string): TeamKind | null {
  const t = titleKey(title);
  return rules.find((r) => r.pattern && t.includes(r.pattern))?.kind ?? null;
}
