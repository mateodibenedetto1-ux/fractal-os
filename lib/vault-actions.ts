'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from './data';
import { supabaseAdmin } from './supabase/admin';
import { syncVaultFromNotion } from './vault';

export async function syncVaultNow(): Promise<{ count: number; error?: string }> {
  await requireStaff();
  const r = await syncVaultFromNotion(supabaseAdmin());
  revalidatePath('/panel/boveda');
  return r;
}
