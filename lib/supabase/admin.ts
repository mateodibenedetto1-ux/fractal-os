import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE, SUPABASE_URL } from '@/lib/env';

/** Cliente con service role. Solo en servidor (webhooks, invitaciones). Saltea RLS. */
export function supabaseAdmin() {
  if (!SUPABASE_SERVICE) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  return createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false } });
}
