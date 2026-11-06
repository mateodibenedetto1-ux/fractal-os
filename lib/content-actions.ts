'use server';

import { revalidatePath } from 'next/cache';
import { requireViewer } from './data';
import { syncInstagram } from './instagram';
import { supabaseAdmin } from './supabase/admin';

async function guard(orgId: string) {
  const v = await requireViewer();
  if (!v.isStaff && !v.clientOrgIds.includes(orgId)) throw new Error('No tenés acceso a este cliente');
}

/** Trae las métricas de Instagram ahora. */
export async function syncContentNow(orgId: string) {
  await guard(orgId);
  const r = await syncInstagram(supabaseAdmin(), orgId, { pages: 6 });
  revalidatePath('/', 'layout');
  return r;
}

/** Desconecta Instagram: borra el token. Las métricas ya guardadas quedan. */
export async function disconnectInstagram(orgId: string) {
  await guard(orgId);
  await supabaseAdmin().from('ig_accounts').delete().eq('org_id', orgId);
  revalidatePath('/', 'layout');
}
