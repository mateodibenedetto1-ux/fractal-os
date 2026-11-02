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

/** Cliente cuyo nombre (o el de alguien de su lado, con alias) aparece en el título: "Daily Marce" → BRAINZEED. */
export function matchClientByTitle(
  orgs: { id: string; name: string; responsables?: { name: string; side: string; aliases?: string[] }[] | null }[],
  title: string,
): string | null {
  const t = ` ${titleKey(title)} `;
  for (const o of orgs) {
    const names = [o.name, ...(o.responsables ?? []).filter((r) => r.side === 'cliente').flatMap((r) => [r.name, ...(r.aliases ?? [])])]
      .map((n) => titleKey(n)).filter((n) => n.length >= 4);
    if (names.some((n) => t.includes(` ${n} `) || t.includes(` ${n.split(' ')[0]} `))) return o.id;
  }
  return null;
}
