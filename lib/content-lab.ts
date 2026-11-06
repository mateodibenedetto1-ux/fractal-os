import 'server-only';
import { supabaseAdmin } from './supabase/admin';

export interface IgAccount {
  username: string | null; name: string | null; picture: string | null; account_type: string | null;
  followers: number | null; media_count: number | null; connected_at: string; last_sync_at: string | null; last_error: string | null;
}
export interface IgMedia {
  id: string; caption: string | null; media_type: string | null; product_type: string | null; permalink: string | null;
  thumbnail: string | null; posted_at: string;
  views: number | null; reach: number | null; likes: number | null; comments: number | null; saved: number | null;
  shares: number | null; interactions: number | null; follows: number | null; profile_visits: number | null; avg_watch_ms: number | null;
  reposts: number | null;
}
export type Format = 'Reel' | 'Carrusel' | 'Foto' | 'Video';
export interface Window { posts: number; views: number; reach: number; interactions: number; saved: number; shares: number; follows: number }
export interface PeriodSummary {
  views: number | null; reach: number | null; interactions: number | null; likes: number | null; comments: number | null;
  shares: number | null; saves: number | null; reposts: number | null; profile_views: number | null;
  follows: number | null; unfollows: number | null;
  views_by_type: Record<string, number>; views_by_follow: Record<string, number>;
}
export interface DailyRow { day: string; views: number | null; reach: number | null; engaged: number | null; new_followers: number | null; followers: number | null }
export interface ContentLab {
  account: IgAccount | null;
  media: (IgMedia & { format: Format; rate: number | null })[];
  last30: Window; prev30: Window;
  followers: { now: number | null; delta30: number | null; series: { day: string; v: number }[] };
  months: { key: string; label: string; posts: number; views: number; reach: number; interactions: number; follows: number }[];
  formats: { format: Format; posts: number; views: number; reach: number; saved: number; shares: number; rate: number | null }[];
  daily: DailyRow[];
  summary: { d7?: PeriodSummary; d30?: PeriodSummary; demo?: Record<string, Record<string, number>>; at?: string; errors?: string[] } | null;
}

const SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY = 86_400_000;

export function formatOf(m: Pick<IgMedia, 'media_type' | 'product_type'>): Format {
  if (m.product_type === 'REELS') return 'Reel';
  if (m.media_type === 'CAROUSEL_ALBUM') return 'Carrusel';
  if (m.media_type === 'VIDEO') return 'Video';
  return 'Foto';
}

const s = (list: IgMedia[], k: keyof IgMedia) => list.reduce((a, m) => a + (Number(m[k]) || 0), 0);
function win(list: IgMedia[]): Window {
  return { posts: list.length, views: s(list, 'views'), reach: s(list, 'reach'), interactions: s(list, 'interactions'), saved: s(list, 'saved'), shares: s(list, 'shares'), follows: s(list, 'follows') };
}

/** Lee todo lo del laboratorio de un cliente. Llamar solo después de validar el acceso a ese cliente. */
export async function getContentLab(orgId: string): Promise<ContentLab> {
  const sb = supabaseAdmin();
  const [{ data: acc }, { data: media }, { data: daily }] = await Promise.all([
    sb.from('ig_accounts').select('username, name, picture, account_type, followers, media_count, connected_at, last_sync_at, last_error, summary').eq('org_id', orgId).maybeSingle(),
    sb.from('ig_media').select('*').eq('org_id', orgId).order('posted_at', { ascending: false }).limit(200),
    sb.from('ig_daily').select('day, followers, views, reach, engaged, new_followers').eq('org_id', orgId).gte('day', new Date(Date.now() - 31 * DAY).toISOString().slice(0, 10)).order('day'),
  ]);
  const list = ((media ?? []) as IgMedia[]).map((m) => ({ ...m, format: formatOf(m), rate: m.reach ? (m.interactions ?? 0) / m.reach : null }));
  const now = Date.now();
  const inRange = (from: number, to: number) => list.filter((m) => { const t = new Date(m.posted_at).getTime(); return t >= now - from * DAY && t < now - to * DAY; });

  const dailyRows = (daily ?? []) as DailyRow[];
  const series = dailyRows.filter((d) => d.followers != null).map((d) => ({ day: d.day, v: d.followers as number }));
  const old = series.find((d) => new Date(d.day).getTime() >= now - 30 * DAY);
  const nowF = (acc?.followers as number | null) ?? series.at(-1)?.v ?? null;

  const months = [];
  const base = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const ms = list.filter((m) => m.posted_at.slice(0, 7) === key);
    months.push({ key, label: SHORT[d.getMonth()], posts: ms.length, views: s(ms, 'views'), reach: s(ms, 'reach'), interactions: s(ms, 'interactions'), follows: s(ms, 'follows') });
  }

  const last90 = inRange(90, 0);
  const formats = (['Reel', 'Carrusel', 'Foto', 'Video'] as Format[]).map((f) => {
    const ms = last90.filter((m) => m.format === f);
    const reach = s(ms, 'reach');
    return { format: f, posts: ms.length, views: ms.length ? s(ms, 'views') / ms.length : 0, reach: ms.length ? reach / ms.length : 0, saved: ms.length ? s(ms, 'saved') / ms.length : 0, shares: ms.length ? s(ms, 'shares') / ms.length : 0, rate: reach ? s(ms, 'interactions') / reach : null };
  }).filter((f) => f.posts > 0);

  const { summary, ...account } = (acc ?? {}) as IgAccount & { summary?: ContentLab['summary'] };
  return {
    account: acc ? (account as IgAccount) : null,
    daily: dailyRows,
    summary: summary ?? null,
    media: list,
    last30: win(inRange(30, 0)), prev30: win(inRange(60, 30)),
    followers: { now: nowF, delta30: nowF != null && old ? nowF - old.v : null, series },
    months, formats,
  };
}
