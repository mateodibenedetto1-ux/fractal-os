'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ContentLab, DailyRow, PeriodSummary } from '@/lib/content-lab';

export type DashTab = 'rendimiento' | 'contenido' | 'audiencia';

const fmt = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('es-AR'));
const kfmt = (n: number | null | undefined) => {
  if (n == null) return '—';
  const a = Math.abs(n);
  return a >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M` : a >= 10_000 ? `${(n / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}K` : fmt(n);
};
const pct = (n: number | null) => (n == null ? '—' : `${(n * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`);
const dlabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);

const TYPE: Record<string, string> = { REEL: 'Reels', REELS: 'Reels', POST: 'Posts', FEED: 'Posts', CAROUSEL_CONTAINER: 'Carruseles', STORY: 'Historias', AD: 'Anuncios', IGTV: 'Videos', LIVE: 'En vivo' };
const FOLLOW: Record<string, string> = { FOLLOWER: 'Seguidores', NON_FOLLOWER: 'No seguidores', UNKNOWN: 'Sin dato' };
const GENDER: Record<string, string> = { F: 'Mujeres', M: 'Hombres', U: 'Sin dato' };

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => { const t = setTimeout(() => setM(true), 60); return () => clearTimeout(t); }, []);
  return m;
}

/** Línea diaria (vistas o alcance). */
function DailyLine({ rows, k, label }: { rows: DailyRow[]; k: 'views' | 'reach'; label: string }) {
  const mounted = useMounted();
  const pts = rows.map((r) => ({ day: r.day, v: r[k] ?? 0 }));
  if (pts.length < 2) return <p className="fin-muted small">Todavía no hay suficientes días cargados.</p>;
  const W = 640, H = 200, P = 30;
  const max = Math.max(1, ...pts.map((p) => p.v)) * 1.1;
  const x = (i: number) => P + (i * (W - P * 2)) / (pts.length - 1);
  const y = (v: number) => H - 26 - (v / max) * (H - 50);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const peak = pts.reduce((b, p, i) => (p.v > pts[b].v ? i : b), 0);
  const ticks = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`fin-svg ${mounted ? 'on' : ''}`} role="img" aria-label={label}>
      <defs><linearGradient id={`g-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--brand)', stopOpacity: 0.18 }} /><stop offset="1" style={{ stopColor: 'var(--brand)', stopOpacity: 0 }} /></linearGradient></defs>
      {[0.5, 1].map((f) => (
        <g key={f}>
          <line x1={P} x2={W - P} y1={y((max / 1.1) * f)} y2={y((max / 1.1) * f)} className="fin-grid" />
          <text x={P - 6} y={y((max / 1.1) * f) + 4} className="fin-axis" textAnchor="end">{kfmt((max / 1.1) * f)}</text>
        </g>
      ))}
      <path d={`${line} L${x(pts.length - 1)},${H - 26} L${x(0)},${H - 26} Z`} fill={`url(#g-${k})`} className="fin-area" />
      <path d={line} style={{ stroke: 'var(--brand)' }} className="fin-line" />
      <circle cx={x(peak)} cy={y(pts[peak].v)} r="4" className="fin-dot" style={{ fill: 'var(--surface)', stroke: 'var(--brand)', strokeWidth: 2, animationDelay: '1s' }} />
      <text x={x(peak)} y={y(pts[peak].v) - 10} className="fin-tip" textAnchor="middle" style={{ fill: 'var(--brand)' }}>{kfmt(pts[peak].v)}</text>
      {ticks.map((i) => <text key={i} x={x(i)} y={H - 6} className="fin-axis" textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}>{dlabel(pts[i].day)}</text>)}
    </svg>
  );
}

/** Barras de seguidores ganados por día, con la pieza publicada ese día. */
function FollowerBars({ rows, postsByDay }: { rows: DailyRow[]; postsByDay: Map<string, ContentLab['media']> }) {
  const mounted = useMounted();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.new_followers ?? 0));
  if (!rows.some((r) => r.new_followers != null)) return <p className="fin-muted small">Instagram todavía no devolvió los seguidores por día. Se completa en la próxima actualización.</p>;
  const focus = hover ?? rows.reduce((b, r, i) => ((r.new_followers ?? 0) > (rows[b].new_followers ?? 0) ? i : b), 0);
  const f = rows[focus];
  const posts = postsByDay.get(f.day) ?? [];
  return (
    <div>
      <div className="ct-fbars" onMouseLeave={() => setHover(null)}>
        {rows.map((r, i) => (
          <button key={r.day} className={`ct-fbar ${i === focus ? 'on' : ''} ${postsByDay.has(r.day) ? 'post' : ''}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)} aria-label={`${dlabel(r.day)}: ${fmt(r.new_followers)} seguidores`}>
            <span style={{ height: mounted ? `${((r.new_followers ?? 0) / max) * 100}%` : 0, transitionDelay: `${i * 15}ms` }} />
          </button>
        ))}
      </div>
      <div className="ct-fbar-axis"><span>{dlabel(rows[0].day)}</span><span>{dlabel(rows[rows.length - 1].day)}</span></div>
      <div className="ct-focus">
        <div><b>{fmt(f.new_followers)}</b> seguidores el {dlabel(f.day)}</div>
        {posts.length ? (
          <ul>{posts.map((p) => <li key={p.id}><a href={p.permalink ?? '#'} target="_blank" rel="noreferrer">{(p.caption ?? 'Sin texto').split('\n')[0].slice(0, 70)}</a> <em>{p.format}</em> <span className="fin-muted">{kfmt(p.views)} vistas</span></li>)}</ul>
        ) : <p className="fin-muted small">Ese día no se publicó nada en el feed: los seguidores vinieron de piezas anteriores o de historias.</p>}
      </div>
    </div>
  );
}

function Split({ parts, labels, keepOrder }: { parts: Record<string, number>; labels: Record<string, string>; keepOrder?: boolean }) {
  const mounted = useMounted();
  const list = Object.entries(parts).filter(([, v]) => v > 0).sort((a, b) => (keepOrder ? a[0].localeCompare(b[0]) : b[1] - a[1]));
  const max = Math.max(1, ...list.map(([, v]) => v));
  if (!list.length) return <p className="fin-muted small">Sin datos para este período.</p>;
  return (
    <ul className="ct-split">
      {list.map(([k, v], i) => (
        <li key={k}>
          <div className="ct-split-row"><span>{labels[k] ?? k}</span><b>{kfmt(v)}</b></div>
          <span className="fin-meter big"><span style={{ width: mounted ? `${(v / max) * 100}%` : 0, transitionDelay: `${i * 70}ms` }} /></span>
        </li>
      ))}
    </ul>
  );
}

function Kpi({ label, value, sub, tone, text }: { label: string; value: number | null | undefined; sub?: string; tone?: 'ok' | 'brand'; text?: string }) {
  return (
    <div className="fin-card fin-kpi">
      <div className="fin-label">{label}</div>
      <div className="fin-kpi-v" style={tone ? { color: `var(--${tone})` } : undefined}>{text ?? kfmt(value ?? null)}</div>
      {sub && <span className="fin-delta fin-muted">{sub}</span>}
    </div>
  );
}

// ---------- Pestañas ----------

type SortKey = 'views' | 'reach' | 'follows' | 'dayFollowers' | 'likes' | 'comments' | 'reposts' | 'shares' | 'saved' | 'rate';
const SORTS: { k: SortKey; l: string }[] = [
  { k: 'views', l: 'Vistas' }, { k: 'reach', l: 'Alcance' }, { k: 'dayFollowers', l: 'Seguidores del día' }, { k: 'follows', l: 'Seguidores (pieza)' },
  { k: 'likes', l: 'Likes' }, { k: 'comments', l: 'Comentarios' }, { k: 'reposts', l: 'Reposts' }, { k: 'shares', l: 'Compartidos' }, { k: 'saved', l: 'Guardados' }, { k: 'rate', l: '% interacción' },
];

export function ContentDashboard({ lab, tab, days }: { lab: ContentLab; tab: DashTab; days: 7 | 30 }) {
  const s: PeriodSummary | undefined = days === 7 ? lab.summary?.d7 : lab.summary?.d30;
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = lab.daily.filter((d) => d.day >= from && d.day < new Date().toISOString().slice(0, 10));
  const media = lab.media.filter((m) => m.posted_at.slice(0, 10) >= from && m.product_type !== 'STORY');
  const postsByDay = useMemo(() => {
    const map = new Map<string, ContentLab['media']>();
    for (const m of media) { const d = m.posted_at.slice(0, 10); map.set(d, [...(map.get(d) ?? []), m]); }
    return map;
  }, [media]);
  const dayF = useMemo(() => new Map(lab.daily.map((d) => [d.day, d.new_followers])), [lab.daily]);
  const [sort, setSort] = useState<SortKey>('views');

  const gained = s?.follows ?? sum(rows.map((r) => r.new_followers));
  const net = s?.follows != null && s?.unfollows != null ? s.follows - s.unfollows : null;
  const errors = lab.summary?.errors ?? [];

  if (tab === 'rendimiento') {
    return (
      <>
        <section className="fin-kpis ct-kpis">
          <Kpi label="Vistas" value={s?.views ?? sum(rows.map((r) => r.views))} />
          <Kpi label="Personas alcanzadas" value={s?.reach ?? null} sub={s?.reach == null ? 'se completa al actualizar' : undefined} />
          <Kpi label="Seguidores ganados" value={gained} tone="ok" />
          <Kpi label="Interacciones" value={s?.interactions} />
          <Kpi label="Visitas al perfil" value={s?.profile_views} />
          <Kpi label="Piezas publicadas" value={media.length} />
        </section>
        <section className="fin-two">
          <div className="fin-card">
            <div className="fin-label"><span>Vistas por día</span><i /><span className="fin-muted small">últimos {days} días</span></div>
            <DailyLine rows={rows} k="views" label="Vistas por día" />
          </div>
          <div className="fin-card">
            <div className="fin-label"><span>Vistas por tipo de contenido</span><i /></div>
            <Split parts={Object.fromEntries(Object.entries(s?.views_by_type ?? {}).filter(([k]) => k in TYPE))} labels={TYPE} />
            <div className="fin-label" style={{ marginTop: 18 }}><span>Quién las vio</span><i /></div>
            <Split parts={s?.views_by_follow ?? {}} labels={FOLLOW} />
          </div>
        </section>
        <section className="fin-card">
          <div className="fin-label"><span>Seguidores ganados por día y qué se publicó</span><i /><span className="fin-muted small">tocá una barra</span></div>
          <FollowerBars rows={rows} postsByDay={postsByDay} />
        </section>
        {errors.length > 0 && <details className="fin-foot"><summary>Algunas métricas no llegaron de Instagram</summary>{errors.join(' · ')}</details>}
      </>
    );
  }

  if (tab === 'contenido') {
    const val = (m: ContentLab['media'][number]) =>
      sort === 'rate' ? m.rate ?? -1 : sort === 'dayFollowers' ? dayF.get(m.posted_at.slice(0, 10)) ?? -1 : (m[sort] as number | null) ?? -1;
    const list = [...media].sort((a, b) => val(b) - val(a));
    const cols = SORTS.filter((c) => c.k !== 'follows' || media.some((m) => m.follows != null));
    return (
      <section className="fin-card">
        <div className="fin-label"><span>{list.length} piezas en los últimos {days} días</span><i /><span className="fin-muted small">tocá una columna para ordenar</span></div>
        <div className="ct-table-wrap">
          <table className="ct-table">
            <thead>
              <tr>
                <th>#</th><th>Pieza</th>
                {cols.map((c) => <th key={c.k} className={sort === c.k ? 'on' : ''}><button onClick={() => setSort(c.k)}>{c.l}</button></th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((m, i) => {
                const d = m.posted_at.slice(0, 10);
                const df = dayF.get(d);
                const v: Record<SortKey, string> = {
                  views: kfmt(m.views), reach: kfmt(m.reach), dayFollowers: df == null ? '—' : `+${fmt(df)}`, follows: m.follows == null ? '—' : fmt(m.follows),
                  likes: kfmt(m.likes), comments: kfmt(m.comments), reposts: kfmt(m.reposts), shares: kfmt(m.shares), saved: kfmt(m.saved), rate: pct(m.rate),
                };
                return (
                  <tr key={m.id}>
                    <td className="ct-pos">{i + 1}</td>
                    <td>
                      <a className="ct-piece" href={m.permalink ?? '#'} target="_blank" rel="noreferrer">
                        {m.thumbnail ? <img src={m.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="ct-noimg" />}
                        <span><b>{(m.caption ?? 'Sin texto').split('\n')[0].slice(0, 60)}</b><em>{m.format} · {dlabel(d)}{(postsByDay.get(d)?.length ?? 0) > 1 ? ' · día compartido' : ''}</em></span>
                      </a>
                    </td>
                    {cols.map((c) => <td key={c.k} className={`${sort === c.k ? 'on' : ''} ${c.k === 'dayFollowers' && df ? 'ok' : ''}`}>{v[c.k]}</td>)}
                  </tr>
                );
              })}
              {!list.length && <tr><td colSpan={cols.length + 2} className="fin-muted">No hay piezas publicadas en este período.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="fin-foot">"Seguidores del día" son los seguidores que ganó la cuenta el día que salió la pieza: sirve para comparar una pieza con la anterior. Instagram no da los seguidores exactos de cada reel; cuando los da (posts y carruseles), aparece la columna "Seguidores (pieza)".</p>
      </section>
    );
  }

  // Audiencia
  const demo = lab.summary?.demo ?? {};
  const countryName = (code: string) => { try { return new Intl.DisplayNames(['es'], { type: 'region' }).of(code) ?? code; } catch { return code; } };
  const top = (parts: Record<string, number> = {}, n = 6, map?: (k: string) => string) =>
    Object.fromEntries(Object.entries(parts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [map ? map(k) : k, v]));
  const ageOrder = Object.fromEntries(Object.entries(demo.age ?? {}).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v], i) => [`${String(i).padStart(2, '0')}|${k}`, v]));
  return (
    <>
      <section className="fin-kpis ct-kpis">
        <Kpi label="Seguidores" value={lab.followers.now} />
        <Kpi label="Seguidores netos" value={net} tone="ok" sub={net == null ? 'se completa al actualizar' : `últimos ${days} días`} />
        <Kpi label="Follows" value={s?.follows ?? gained} />
        <Kpi label="Unfollows" value={s?.unfollows} tone="brand" />
        <Kpi label="Visitas al perfil" value={s?.profile_views} />
        <Kpi label="Follows por visita al perfil" value={null} text={s?.profile_views && s?.follows ? pct(s.follows / s.profile_views) : '—'} sub="aproximado" />
      </section>
      <section className="fin-card">
        <div className="fin-label"><span>Seguidores ganados por día</span><i /><span className="fin-muted small">tocá una barra para ver qué se publicó</span></div>
        <FollowerBars rows={rows} postsByDay={postsByDay} />
      </section>
      <section className="fin-two">
        <div className="fin-card">
          <div className="fin-label"><span>Género</span><i /></div>
          <Split parts={top(demo.gender, 3, (k) => GENDER[k] ?? k)} labels={{}} />
          <div className="fin-label" style={{ marginTop: 18 }}><span>Edad</span><i /></div>
          <Split parts={ageOrder} labels={Object.fromEntries(Object.keys(ageOrder).map((k) => [k, k.split('|')[1]]))} keepOrder />
        </div>
        <div className="fin-card">
          <div className="fin-label"><span>Países principales</span><i /></div>
          <Split parts={top(demo.country, 6, countryName)} labels={{}} />
          <div className="fin-label" style={{ marginTop: 18 }}><span>Ciudades principales</span><i /></div>
          <Split parts={top(demo.city, 6)} labels={{}} />
        </div>
      </section>
      <p className="fin-foot">La demografía es de todos los seguidores actuales (Instagram no la separa por período).</p>
    </>
  );
}
