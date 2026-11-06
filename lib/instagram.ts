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
const IGRAPH = `https://graph.instagram.com/${V}`;
/** Host según cómo resolvió la cuenta: 'ig' = API de Instagram, 'fb' = API de Facebook. */
const hostOf = (kind: string | null | undefined) => (kind === 'ig' ? IGRAPH : GRAPH);

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

/** Busca la cuenta de Instagram que se compartió en el login. Prueba varias vías y, si ninguna funciona, devuelve qué respondió Meta. */
async function findInstagram(token: string, hint?: string | null): Promise<{ ids: string[]; kind: 'ig' | 'fb' }> {
  const tried: string[] = [];
  // 0) Configuración compatible con el login de Instagram: el token sirve directo en graph.instagram.com
  try {
    const me = await ig<{ user_id?: string; id?: string; username?: string }>(`${IGRAPH}/me?${new URLSearchParams({ fields: 'user_id,username', access_token: token })}`);
    const id = me.user_id ?? me.id;
    if (id) return { ids: [String(id)], kind: 'ig' };
    tried.push('graph.instagram.com/me: sin id');
  } catch (e) { tried.push(`graph.instagram.com/me: ${(e as Error).message}`); }
  // 1) Los permisos del token dicen sobre qué cuentas se dieron (target_ids de instagram_basic)
  try {
    const app = `${process.env.INSTAGRAM_APP_ID}|${process.env.INSTAGRAM_APP_SECRET}`;
    const d = await ig<{ data: any }>(`${GRAPH}/debug_token?${new URLSearchParams({ input_token: token, access_token: app })}`);
    const scopes: { scope: string; target_ids?: string[] }[] = d.data.granular_scopes ?? [];
    tried.push(`token: type=${d.data.type ?? '-'} user=${d.data.user_id ?? '-'} profile=${d.data.profile_id ?? '-'}`);
    // Todas las cuentas que se marcaron en la ventana de Facebook
    const ids = (scopes.find((x) => x.scope === 'instagram_basic') ?? scopes.find((x) => x.scope === 'instagram_manage_insights'))?.target_ids ?? [];
    if (ids.length) return { ids: [...new Set(ids)], kind: 'fb' };
    tried.push(`debug_token: sin cuentas (${scopes.map((x) => x.scope).join(', ') || 'sin permisos'})`);
  } catch (e) { tried.push(`debug_token: ${(e as Error).message}`); }
  // 2) Cuentas asignadas al usuario del sistema
  // Meta asigna la cuenta al usuario del sistema unos segundos después del login: se reintenta
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const j = await ig<{ data: any[] }>(`${GRAPH}/me/assigned_instagram_accounts?${new URLSearchParams({ fields: 'id,username', access_token: token })}`);
      const first = j.data?.[0];
      if (first?.id) {
        try { await profile(token, first.id, 'fb'); return { ids: [first.id], kind: 'fb' }; }
        catch (e) { tried.push(`assigned ${first.id} (${first.username ?? '-'}): perfil falla (${(e as Error).message})`); break; }
      }
      if (attempt === 3) tried.push('me/assigned_instagram_accounts: vacío tras 4 intentos');
    } catch (e) { tried.push(`me/assigned_instagram_accounts: ${(e as Error).message}`); break; }
    await new Promise((r) => setTimeout(r, 2500));
  }
  // 3) Por el portfolio comercial al que pertenece el usuario del sistema
  const businesses: string[] = [];
  if (hint) businesses.push(hint);
  for (const q of [`me?fields=id,name,client_business_id`, `me/businesses?fields=id,name`]) {
    try {
      const j = await ig<any>(`${GRAPH}/${q}&${new URLSearchParams({ access_token: token })}`);
      if (j.client_business_id) businesses.push(String(j.client_business_id));
      for (const b of j.data ?? []) if (b.id) businesses.push(b.id);
      tried.push(`${q.split('?')[0]}: ${j.client_business_id ?? ((j.data ?? []).map((b: any) => b.id).join(',') || '-')}`);
    } catch (e) { tried.push(`${q.split('?')[0]}: ${(e as Error).message}`); }
  }
  for (const b of [...new Set(businesses)]) {
    for (const edge of ['owned_instagram_assets', 'instagram_business_accounts', 'owned_instagram_accounts', 'instagram_accounts', 'client_instagram_assets']) {
      try {
        const j = await ig<{ data: any[] }>(`${GRAPH}/${b}/${edge}?${new URLSearchParams({ fields: 'id,username', access_token: token })}`);
        const first = j.data?.[0];
        if (first?.id) {
          // Algunas vías devuelven el id "viejo" de Instagram: se valida pidiendo el perfil
          try { await profile(token, first.id, 'fb'); return { ids: [first.id], kind: 'fb' }; } catch (e) { tried.push(`${b}/${edge}: id ${first.id} no sirve (${(e as Error).message})`); }
        } else tried.push(`${b}/${edge}: vacío`);
      } catch (e) { tried.push(`${b}/${edge}: ${(e as Error).message}`); }
    }
  }
  // 4) Cuenta vinculada a una página de Facebook
  try {
    const j = await ig<{ data: { instagram_business_account?: { id: string } }[] }>(`${GRAPH}/me/accounts?${new URLSearchParams({ fields: 'instagram_business_account{id,username}', access_token: token })}`);
    const ids = (j.data ?? []).map((p) => p.instagram_business_account?.id).filter(Boolean) as string[];
    if (ids.length) return { ids, kind: 'fb' };
    tried.push('me/accounts: sin cuenta de Instagram');
  } catch (e) { tried.push(`me/accounts: ${(e as Error).message}`); }
  throw new Error(`No encontramos la cuenta de Instagram en el acceso. Detalle para soporte: ${tried.join(' | ')}`);
}

/** code → token (del sistema, no vence) + cuenta de Instagram, guardado cifrado. */
export async function connectAccount(sb: SupabaseClient, orgId: string, userId: string, code: string, businessHint?: string | null) {
  const t = await ig<{ access_token: string; expires_in?: number }>(`${GRAPH}/oauth/access_token?${new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    redirect_uri: igRedirect(),
    code,
  })}`);
  const found = await findInstagram(t.access_token, businessHint);
  const out: { id: string; username: string }[] = [];
  const failed: string[] = [];
  for (const igId of found.ids) {
    try {
      const me = await profile(t.access_token, igId, found.kind);
      const { error } = await sb.from('ig_accounts').upsert({
        org_id: orgId,
        ig_user_id: igId,
        username: me.username, name: me.name ?? null, picture: me.profile_picture_url ?? null, account_type: found.kind,
        followers: me.followers_count ?? null, follows: me.follows_count ?? null, media_count: me.media_count ?? null,
        token: encrypt(t.access_token),
        token_expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
        connected_by: userId, connected_at: new Date().toISOString(), last_error: null,
      }, { onConflict: 'org_id,ig_user_id' });
      if (error) throw new Error(error.message);
      out.push({ id: igId, username: me.username });
    } catch (e) { failed.push(`${igId}: ${(e as Error).message}`); }
  }
  if (!out.length) throw new Error(`No se pudo leer ninguna cuenta. ${failed.join(' | ')}`);
  return out;
}

function profile(token: string, igId: string, kind?: string | null) {
  return ig<any>(`${hostOf(kind)}/${kind === 'ig' ? 'me' : igId}?${new URLSearchParams({ fields: 'username,name,profile_picture_url,followers_count,follows_count,media_count', access_token: token })}`);
}

/** El token de usuario del sistema no vence; si Meta lo invalida, el sync guarda el error y se reconecta. */
function tokenOf(acc: { token: string }) {
  return decrypt(acc.token);
}

// ---------- Sincronización ----------

/** Métricas por tipo: pedir una que no aplica devuelve error, así que van separadas. */
const MEDIA_METRICS: Record<string, string[]> = {
  // follows/profile_visits en reels: si Meta no lo da, se omite solo (ver el fallback de abajo)
  REELS: ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time', 'reposts', 'follows', 'profile_visits'],
  FEED: ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'follows', 'profile_visits', 'reposts'],
};

async function mediaInsights(id: string, product: string, token: string, kind?: string | null) {
  const metrics = MEDIA_METRICS[product] ?? MEDIA_METRICS.FEED;
  const read = async (list: string[]) => {
    const j = await ig<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
      `${hostOf(kind)}/${id}/insights?${new URLSearchParams({ metric: list.join(','), access_token: token })}`,
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

const n = (v: unknown) => (typeof v === 'number' ? Math.round(v) : null);
const DAYS = 86_400;
const dayStart = (offset: number) => { const t = new Date(); return Math.floor(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - offset) / 1000); };
const isoDay = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

type Breakdown = Record<string, number>;
/** Lee una métrica total_value (con breakdown opcional) de la cuenta en un rango. */
async function accountTotal(token: string, base: string, metric: string, since: number, until: number, breakdown?: string) {
  const p: Record<string, string> = { metric, period: 'day', metric_type: 'total_value', since: String(since), until: String(until), access_token: token };
  if (breakdown) p.breakdown = breakdown;
  const j = await ig<{ data: { total_value?: { value?: number; breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[] }>(`${base}/insights?${new URLSearchParams(p)}`);
  const tv = j.data[0]?.total_value;
  const parts: Breakdown = {};
  for (const r of tv?.breakdowns?.[0]?.results ?? []) parts[r.dimension_values.join(' · ')] = r.value;
  return { value: tv?.value ?? null, parts };
}

/**
 * Métricas de cuenta para el dashboard (Rendimiento y Audiencia):
 * - por día de los últimos 30 días: vistas, alcance, cuentas que interactuaron y seguidores ganados
 * - por período (7 y 30 días): totales, follows/unfollows, vistas por tipo de contenido y por seguidor/no seguidor
 * - demografía de seguidores
 */
async function syncAccountInsights(sb: SupabaseClient, orgId: string, token: string, igId: string, kind: string | null) {
  const key = { org_id: orgId, ig_user_id: igId };
  const base = `${hostOf(kind)}/${kind === 'ig' ? 'me' : igId}`;
  const errors: string[] = [];
  const safe = async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    try { return await fn(); } catch (e) { errors.push(`${label}: ${(e as Error).message}`); return null; }
  };

  // Días que faltan (los últimos 30), y siempre ayer y anteayer porque Meta consolida tarde
  const { data: have } = await sb.from('ig_daily').select('day').eq('org_id', orgId).eq('ig_user_id', igId).not('views', 'is', null).gte('day', isoDay(dayStart(30)));
  const got = new Set((have ?? []).map((d) => d.day));
  const missing = Array.from({ length: 30 }, (_, i) => dayStart(i + 1)).filter((d, i) => i < 2 || !got.has(isoDay(d)));
  for (let i = 0; i < missing.length; i += 5) {
    await Promise.all(missing.slice(i, i + 5).map(async (d) => {
      const [views, reach, engaged] = await Promise.all(['views', 'reach', 'accounts_engaged'].map((m) => safe(m, () => accountTotal(token, base, m, d, d + DAYS))));
      await sb.from('ig_daily').upsert({ ...key, day: isoDay(d), views: n(views?.value), reach: n(reach?.value), engaged: n(engaged?.value) });
    }));
  }

  // Seguidores ganados por día (Meta da los últimos 30 días)
  await safe('follower_count', async () => {
    const j = await ig<{ data: { values?: { value: number; end_time: string }[] }[] }>(`${base}/insights?${new URLSearchParams({ metric: 'follower_count', period: 'day', since: String(dayStart(29)), until: String(dayStart(0)), access_token: token })}`);
    for (const v of j.data[0]?.values ?? []) {
      const day = isoDay(Math.floor(new Date(v.end_time).getTime() / 1000) - DAYS);
      await sb.from('ig_daily').upsert({ ...key, day, new_followers: v.value });
    }
  });

  // Resumen por período
  const window = async (days: number) => {
    const since = dayStart(days), until = dayStart(0);
    const t = (m: string, b?: string) => safe(`${m}${b ? `/${b}` : ''} ${days}d`, () => accountTotal(token, base, m, since, until, b));
    const [views, reach, interactions, likes, comments, shares, saves, reposts, profile, follows, byType, byFollow] = await Promise.all([
      t('views'), t('reach'), t('total_interactions'), t('likes'), t('comments'), t('shares'), t('saves'), t('reposts'), t('profile_views'),
      t('follows_and_unfollows', 'follow_type'), t('views', 'media_product_type'), t('views', 'follow_type'),
    ]);
    const fu = follows?.parts ?? {};
    return {
      views: views?.value ?? null, reach: reach?.value ?? null, interactions: interactions?.value ?? null,
      likes: likes?.value ?? null, comments: comments?.value ?? null, shares: shares?.value ?? null, saves: saves?.value ?? null,
      reposts: reposts?.value ?? null, profile_views: profile?.value ?? null,
      follows: fu.FOLLOWER ?? null, unfollows: fu.NON_FOLLOWER ?? null,
      views_by_type: byType?.parts ?? {}, views_by_follow: byFollow?.parts ?? {},
    };
  };
  const [d7, d30] = await Promise.all([window(7), window(30)]);

  // Demografía de seguidores
  const demo: Record<string, Breakdown> = {};
  await Promise.all(['age', 'gender', 'country', 'city'].map(async (b) => {
    for (const timeframe of ['this_month', 'last_30_days', 'last_90_days']) {
      try {
        const j = await ig<{ data: { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[] }>(
          `${base}/insights?${new URLSearchParams({ metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', timeframe, breakdown: b, access_token: token })}`,
        );
        const parts: Breakdown = {};
        for (const r of j.data[0]?.total_value?.breakdowns?.[0]?.results ?? []) parts[r.dimension_values.join(' · ')] = r.value;
        demo[b] = parts;
        return;
      } catch (e) { if (timeframe === 'last_90_days') errors.push(`demografía ${b}: ${(e as Error).message}`); }
    }
  }));

  await sb.from('ig_accounts').update({ summary: { d7, d30, demo, at: new Date().toISOString(), errors: errors.slice(0, 12) } }).eq('org_id', orgId).eq('ig_user_id', igId);
}

/** Trae perfil, últimas piezas con métricas y el día de la cuenta. */
export async function syncInstagram(sb: SupabaseClient, orgId: string, igUserId: string, opts: { pages?: number } = {}) {
  const { data: acc } = await sb.from('ig_accounts').select('org_id, ig_user_id, token, account_type').eq('org_id', orgId).eq('ig_user_id', igUserId).maybeSingle();
  if (!acc) return { ok: false, error: 'Sin cuenta conectada' };
  try {
    const token = tokenOf(acc);
    const igId = acc.ig_user_id as string;
    const kind = acc.account_type as string | null;
    const me = await profile(token, igId, kind);
    await sb.from('ig_accounts').update({
      username: me.username, name: me.name ?? null, picture: me.profile_picture_url ?? null,
      followers: me.followers_count ?? null, follows: me.follows_count ?? null, media_count: me.media_count ?? null,
    }).eq('org_id', orgId).eq('ig_user_id', igId);

    // Piezas: hasta `pages` páginas de 25 (las más recientes primero)
    let url: string | null = `${hostOf(kind)}/${kind === 'ig' ? 'me' : igId}/media?${new URLSearchParams({ fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp', limit: '25', access_token: token })}`;
    let count = 0;
    for (let page = 0; url && page < (opts.pages ?? 4); page++) {
      const j: { data: any[]; paging?: { next?: string } } = await ig(url);
      // Se leen de a 6 piezas en paralelo para no pasarse del tiempo de la función
      for (let i = 0; i < j.data.length; i += 6) {
        await Promise.all(j.data.slice(i, i + 6).map(async (m: any) => {
          const product = m.media_product_type === 'REELS' ? 'REELS' : 'FEED';
          const ins = await mediaInsights(m.id, product, token, kind);
          const row = {
            id: m.id, org_id: orgId, ig_user_id: igId, caption: m.caption ?? null, media_type: m.media_type, product_type: m.media_product_type ?? product,
            permalink: m.permalink, thumbnail: m.thumbnail_url ?? (m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM' ? m.media_url : null) ?? null,
            posted_at: m.timestamp,
            views: n(ins.views), reach: n(ins.reach), likes: n(ins.likes), comments: n(ins.comments), saved: n(ins.saved), shares: n(ins.shares),
            interactions: n(ins.total_interactions), follows: n(ins.follows), profile_visits: n(ins.profile_visits),
            avg_watch_ms: n(ins.ig_reels_avg_watch_time), reposts: n(ins.reposts), updated_at: new Date().toISOString(),
          };
          await sb.from('ig_media').upsert(row);
          // Foto de las piezas de los últimos 30 días, para ver la curva
          if (Date.now() - new Date(m.timestamp).getTime() < 30 * 86_400_000) {
            await sb.from('ig_media_snapshots').insert({ media_id: m.id, views: row.views, reach: row.reach, interactions: row.interactions, follows: row.follows });
          }
          count++;
        }));
      }
      url = j.paging?.next ?? null;
    }

    // Métricas de cuenta (día a día, por período y demografía) + seguidores de hoy
    await syncAccountInsights(sb, orgId, token, igId, kind);
    const today = new Date();
    await sb.from('ig_daily').upsert({ org_id: orgId, ig_user_id: igId, day: today.toISOString().slice(0, 10), followers: me.followers_count ?? null }, { onConflict: 'org_id,ig_user_id,day', ignoreDuplicates: false });

    await sb.from('ig_accounts').update({ last_sync_at: new Date().toISOString(), last_error: null }).eq('org_id', orgId).eq('ig_user_id', igId);
    return { ok: true, media: count };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await sb.from('ig_accounts').update({ last_error: error }).eq('org_id', orgId).eq('ig_user_id', igUserId);
    return { ok: false, error };
  }
}

/** Para el cron: todas las cuentas conectadas. */
export async function syncAllInstagram(sb: SupabaseClient) {
  const { data } = await sb.from('ig_accounts').select('org_id, ig_user_id');
  const out = [];
  for (const a of data ?? []) out.push({ org: a.org_id, account: a.ig_user_id, ...(await syncInstagram(sb, a.org_id, a.ig_user_id)) });
  return out;
}
