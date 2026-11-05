'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { requireStaff } from './data';
import { canSeeFinance, FINANCE_TAG } from './finance';

/** Vuelve a leer los movimientos (después de cada carga mensual). */
export async function refreshFinance() {
  const v = await requireStaff();
  if (!canSeeFinance(v.email)) throw new Error('No tenés acceso a Finanzas.');
  revalidateTag(FINANCE_TAG);
  revalidatePath('/panel/finanzas');
}
