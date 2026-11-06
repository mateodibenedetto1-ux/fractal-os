import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_URL, SUPABASE_SERVICE } from './env';
import { decrypt, encrypt } from './secrets';

/**
 * Instagram API con "Unified login" (Facebook Login for Business con config_id), que es lo único
 * que Meta habilita para apps nuevas. La configuración usa un token de usuario del sistema que no vence,
 * con el activo "Instagram account" y los permisos instagram_basic + instagram_manage_insights.
 * Los datos de Meta pueden tardar hasta 48 h y se guardan hasta 2 años.
 * Variables: INSTAGRAM_APP_ID (ID de la app de Meta), INSTAGRAM_APP_SECRET, INSTAGRAM_CONFIG_ID.
 */
const V = 'v23.0';
const GRAPH = `https://graph.facebook.com/${V}`;

export const igReady = () => Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET && process.env.INSTAGRAM_CONFIG_ID);
export const igRedirect = () => `${APP_URL}/api/instagram/callback`;

// ---------- OAuth ----------

function stateKey() {
  return `fractal-ig:${process.env.AI_KEYS_SECRET || SUPABASE_SERVICE || process.env.INSTAGRAM_APP_SECRET}`;
}

/** state firmado: org + usuario + vencimiento (15 min). */
export function signState(orgId: string, userId: string, back: string) {
  const body = Buffer.from(JSON.stringify({ o: orgId, u: userId, b: back, e: Date.now() + 15 * 60_000 })).toString('base64url');
  const sig = createHmac('sha256', stateKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readState(state: string): { o: string; u: string; b: string } | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const want = createHmac('sha256', stateKey()).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const s = JSON.parse(Buffer.from(body, 'base64url').toString());
  return s.e > Date.now() ? s : null;
}

export function authorizeUrl(state: string) {
  // Con config_id no se manda scope: los permisos y activos los define la configuración
  const p = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: igRedirect(),
    config_id: process.env.INSTAGRAM_CONFIG_ID!,
    response_type: 'code',
    override_default_response_type: 'true',
    state,
  });
  return `https://www.facebook.com/${V}/dialog/oauth?${p}`;
}

async function ig<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) {
    const msg = j.error?.message || j.error_message || `Instagram respondió ${res.status}`;
    throw new Error(msg);
  }
  return j as T;
}

/** Busca la cuenta de Instagram que el cliente compartió en el login. */
async function findInstagram(token: string): Promise<string> {
  // Configuración con token de usuario del sistema: cuentas asignadas
  try {
    const j = await ig<{ data: { id: string }[] }>(`${GRAPH}/me/assigned_instagram_accounts?${new URLSearchParams({ fields: 'id,username', access_token: token })}`);
    if (j.data?.[0]?.id) return j.data[0].id;
  } catch { /* se prueba por páginas */ }
  // Alternativa: cuenta de Instagram vinculada a una página de Facebook
  const j = await ig<{ data: { instagram_business_account?: { id: string } }[] }>(`${GRAPH}/me/accounts?${new URLSearchParams({ fields: 'instagram_business_account{id,username}', access_token: token })}`);
  const id = j.data?.find((p) => p.instagram_business_account)?.instagram_business_account?.id;
  if (!id) throw new Error('No encontramos una cuenta de Instagram en el acceso que diste. Volvé a conectar y elegí la cuenta de Instagram.');
  return id;
}

/** code → token (del sistema, no vence) + cuenta de Instagram, guardado cifrado. */
export async function connectAccount(sb: SupabaseClient, orgId: string, userId: string, code: string) {
  const t = await ig<{ access_token: string; expires_in?: number }>(`${GRAPH}/oauth/access_token?${new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    redirect_uri: igRedirect(),
    code,
  })}`);
  const igId = await findInstagram(t.access_token);
  const me = await profile(t.access_token, igId);
  const { error } = await sb.from('ig_accounts').upsert({
    org_id: orgId,
    ig_user_id: igId,
    username: me.username, name: me.name ?? null, picture: me.profile_picture_url ?? null, account_type: 'BUSINESS',
    followers: me.followers_count ?? null, follows: me.follows_count ?? null, media_count: me.media_count ?? null,
    token: encrypt(t.access_token),
    token_expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
    connected_by: userId, connected_at: new Date().toISOString(), last_error: null,
  });
  if (error) throw new Error(error.message);
  return me.username as string;
}

function profile(token: string, igId: string) {
  return ig<any>(`${GRAPH}/${igId}?${new URLSearchParams({ fields: 'username,name,profile_picture_url,followers_count,follows_count,media_count', access_token: token })}`);
}

/** El token de usuario del sistema no vence; si Meta lo invalida, el sync guarda el error y se reconecta. */
function tokenOf(acc: { token: string }) {
  return decrypt(acc.token);
}

// ---------- Sincronización ----------

/** Métricas por tipo: pedir una que no aplica devuelve error, así que van separadas. */
const MEDIA_METRICS: Record<string, string[]> = {
  REELS: ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time'],
  FEED: ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'follows', 'profile_visits'],
};

async function mediaInsights(id: string, product: string, token: string) {
  const metrics = MEDIA_METRICS[product] ?? MEDIA_METRICS.FEED;
  const read = async (list: string[]) => {
    const j = await ig<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
      `${GRAPH}/${id}/insights?${new URLSearchParams({ metric: list.join(','), access_token: token })}`,
    );
    return Object.fromEntries(j.data.map((m) => [m.name, m.total_value?.value ?? m.values?.[0]?.value ?? null]));
  };
  try {
    return await read(metrics);
  } catch {
    // Si alguna métrica no aplica a esta pieza, se piden de a una
    const out: Record<string, number | null> = {};
    for (const m of metrics) {
      try { Object.assign(out, await read([m])); } catch { /* no disponible para esta pieza */ }
    }
    return out;
  }
}

async function accountDay(token: string, igId: string, since: number, until: number) {
  const out: Record<string, number | null> = {};
  for (const m of ['reach', 'views', 'accounts_engaged', 'total_interactions', 'profile_views']) {
    try {
      const j = await ig<{ data: { name: string; total_value?: { value: number }; values?: { value: number }[] }[] }>(
        `${GRAPH}/${igId}/insights?${new URLSearchParams({ metric: m, period: 'day', metric_type: 'total_value', since: String(since), until: String(until), access_token: token })}`,
      );
      out[m] = j.data[0]?.total_value?.value ?? j.data[0]?.values?.[0]?.value ?? null;
    } catch { out[m] = null; }
  }
  return out;
}

const n = (v: unknown) => (typeof v === 'number' ? Math.round(v) : null);

/** Trae perfil, últimas piezas con métricas y el día de la cuenta. */
export async function syncInstagram(sb: SupabaseClient, orgId: string, opts: { pages?: number } = {}) {
  const { data: acc } = await sb.from('ig_accounts').select('org_id, ig_user_id, token').eq('org_id', orgId).maybeSingle();
  if (!acc) return { ok: false, error: 'Sin cuenta conectada' };
  try {
    const token = tokenOf(acc);
    const igId = acc.ig_user_id as string;
    const me = await profile(token, igId);
    await sb.from('ig_accounts').update({
      username: me.username, name: me.name ?? null, picture: me.profile_picture_url ?? null,
      followers: me.followers_count ?? null, follows: me.follows_count ?? null, media_count: me.media_count ?? null,
    }).eq('org_id', orgId);

    // Piezas: hasta `pages` páginas de 25 (las más recientes primero)
    let url: string | null = `${GRAPH}/${igId}/media?${new URLSearchParams({ fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp', limit: '25', access_token: token })}`;
    let count = 0;
    for (let page = 0; url && page < (opts.pages ?? 2); page++) {
      const j: { data: any[]; paging?: { next?: string } } = await ig(url);
      for (const m of j.data) {
        const product = m.media_product_type === 'REELS' ? 'REELS' : 'FEED';
        const ins = await mediaInsights(m.id, product, token);
        const row = {
          id: m.id, org_id: orgId, caption: m.caption ?? null, media_type: m.media_type, product_type: m.media_product_type ?? product,
          permalink: m.permalink, thumbnail: m.thumbnail_url ?? (m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM' ? m.media_url : null) ?? null,
          posted_at: m.timestamp,
          views: n(ins.views), reach: n(ins.reach), likes: n(ins.likes), comments: n(ins.comments), saved: n(ins.saved), shares: n(ins.shares),
          interactions: n(ins.total_interactions), follows: n(ins.follows), profile_visits: n(ins.profile_visits),
          avg_watch_ms: n(ins.ig_reels_avg_watch_time), updated_at: new Date().toISOString(),
        };
        await sb.from('ig_media').upsert(row);
        // Foto de las piezas de los últimos 30 días, para ver la curva
        if (Date.now() - new Date(m.timestamp).getTime() < 30 * 86_400_000) {
          await sb.from('ig_media_snapshots').insert({ media_id: m.id, views: row.views, reach: row.reach, interactions: row.interactions, follows: row.follows });
        }
        count++;
      }
      url = j.paging?.next ?? null;
    }

    // Día de cuenta: ayer completo + seguidores de hoy
    const today = new Date();
    const y = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
    const day = await accountDay(token, igId, Math.floor(y.getTime() / 1000), Math.floor(y.getTime() / 1000) + 86_400);
    await sb.from('ig_daily').upsert({ org_id: orgId, day: y.toISOString().slice(0, 10), reach: n(day.reach), views: n(day.views), engaged: n(day.accounts_engaged), interactions: n(day.total_interactions), profile_views: n(day.profile_views) });
    await sb.from('ig_daily').upsert({ org_id: orgId, day: today.toISOString().slice(0, 10), followers: me.followers_count ?? null }, { onConflict: 'org_id,day', ignoreDuplicates: false });

    await sb.from('ig_accounts').update({ last_sync_at: new Date().toISOString(), last_error: null }).eq('org_id', orgId);
    return { ok: true, media: count };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await sb.from('ig_accounts').update({ last_error: error }).eq('org_id', orgId);
    return { ok: false, error };
  }
}

/** Para el cron: todas las cuentas conectadas. */
export async function syncAllInstagram(sb: SupabaseClient) {
  const { data } = await sb.from('ig_accounts').select('org_id');
  const out = [];
  for (const a of data ?? []) out.push({ org: a.org_id, ...(await syncInstagram(sb, a.org_id)) });
  return out;
}
