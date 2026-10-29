import 'server-only';
import { unstable_cache } from 'next/cache';
import { NOTION_DB, hasNotion, pageTitle, plainId, prop, queryDatabase, val } from './notion';

export interface Goal {
  id: string | null;
  title: string;
  area: string;
  estado: string;
  actual: number | null;
  meta: number | null;
  unidad: string | null;
  criterio: string | null;
}

export interface Reward {
  id: string | null;
  title: string;
  estado: string;
  hito: string | null;
  condicion: string | null;
  costo: number | null;
}

const load = unstable_cache(
  async () => {
    const [g, r] = await Promise.all([queryDatabase(NOTION_DB.goals), queryDatabase(NOTION_DB.rewards)]);
    const goals: Goal[] = g.map((p) => ({
      id: plainId(p.id), title: pageTitle(p), area: val(prop(p, 'Área', 'Area')) ?? 'Otros', estado: val(prop(p, 'Estado')) ?? 'Por definir',
      actual: val(prop(p, 'Actual')), meta: val(prop(p, 'Meta')), unidad: val(prop(p, 'Unidad')), criterio: val(prop(p, 'Criterio de logro')),
    }));
    const rewards: Reward[] = r.map((p) => ({
      id: plainId(p.id), title: pageTitle(p), estado: val(prop(p, 'Estado')) ?? 'Por asignar', hito: val(prop(p, 'Hito vinculado')),
      condicion: val(prop(p, 'Condición')), costo: val(prop(p, 'Costo estimado USD')),
    }));
    return { goals, rewards };
  },
  ['fractal-goals'],
  { revalidate: 120, tags: ['goals'] },
);

export async function getGoals(): Promise<{ goals: Goal[]; rewards: Reward[]; live: boolean }> {
  if (hasNotion()) {
    try {
      return { ...(await load()), live: true };
    } catch {
      /* sin acceso a la página de Fractal Goals */
    }
  }
  return { goals: [], rewards: [], live: false };
}
