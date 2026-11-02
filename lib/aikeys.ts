import 'server-only';
import { supabaseAdmin } from './supabase/admin';
import { decrypt, encrypt } from './secrets';

export interface AiKeyStatus { connected: boolean; hint: string | null; verified_at: string | null }

export async function getAiKeyStatus(orgId: string): Promise<AiKeyStatus> {
  const { data } = await supabaseAdmin().from('ai_keys').select('key_hint, verified_at').eq('org_id', orgId).maybeSingle();
  return { connected: Boolean(data), hint: data?.key_hint ?? null, verified_at: data?.verified_at ?? null };
}

/** API key del cliente, descifrada. Solo para usar en el servidor al llamar a Anthropic. */
export async function getOrgAiKey(orgId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from('ai_keys').select('key_enc').eq('org_id', orgId).maybeSingle();
  if (!data) return null;
  try { return decrypt(data.key_enc); } catch { return null; }
}

/** Comprueba la key contra Anthropic sin gastar tokens. */
export async function verifyAnthropicKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      cache: 'no-store',
    });
    if (r.ok) return { ok: true };
    if (r.status === 401 || r.status === 403) return { ok: false, error: 'Anthropic rechazó la key. Revisá que la hayas copiado completa.' };
    return { ok: false, error: `Anthropic respondió ${r.status}. Probá de nuevo en un rato.` };
  } catch {
    return { ok: false, error: 'No pude contactar a Anthropic. Probá de nuevo.' };
  }
}

export async function storeAiKey(orgId: string, key: string, userId: string) {
  const { error } = await supabaseAdmin().from('ai_keys').upsert({
    org_id: orgId, provider: 'anthropic', key_enc: encrypt(key), key_hint: key.slice(-4),
    verified_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function deleteAiKey(orgId: string) {
  await supabaseAdmin().from('ai_keys').delete().eq('org_id', orgId);
}
