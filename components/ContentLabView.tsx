'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { disconnectInstagram, syncContentNow } from '@/lib/content-actions';
import type { ContentLab, Window } from '@/lib/content-lab';

const fmt = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('es-AR'));
const kfmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M` : n >= 1000 ? `${(n / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}K` : fmt(n));
const pct = (n: number | null) => (n == null ? '—' : `${(n * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`);
const date = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
const ago = (iso: string | null) => {
  if (!iso) return 'nunca';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

function Count({ value, format = kfmt }: { value: number; format?: (n: number) => string }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(value); return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1000);
      setV(a + (value - a) * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(v)}</>;
}

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => { const t = setTimeout(() => setM(true), 60); return () => clearTimeout(t); }, []);
  return m;
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev) return <span className="fin-delta fin-muted">últimos 30 días</span>;
  const d = (now - prev) / prev;
  return <span className={`fin-delta ${d >= 0 ? 'up' : 'down'}`}>{d >= 0 ? '↑' : '↓'} {Math.abs(Math.round(d * 100))}% vs. 30 días anteriores</span>;
}

type SortKey = 'views' | 'follows' | 'saved' | 'shares' | 'rate';
const SORTS: { k: SortKey; l: string }[] = [
  { k: 'views', l: 'Vistas' },
  { k: 'follows', l: 'Seguidores' },
  { k: 'saved', l: 'Guardados' },
  { k: 'shares', l: 'Compartidos' },
  { k: 'rate', l: '% interacción' },
];

interface Props {
  lab: ContentLab; orgId: string; orgName: string; staff: boolean;
  connectHref: string; ready: boolean; notice?: string; noticeKind: 'ok' | 'err';
}

export function ContentLabView({ lab, orgId, orgName, staff, connectHref, ready, notice, noticeKind }: Props) {
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<SortKey>('views');
  const [err, setErr] = useState<string | null>(null);
  const mounted = useMounted();
  const a = lab.account;

  const ranked = useMemo(() => {
    const val = (m: (typeof lab.media)[number]) => (sort === 'rate' ? m.rate ?? -1 : (m[sort] as number | null) ?? -1);
    return [...lab.media].filter((m) => m.product_type !== 'STORY').sort((x, y) => val(y) - val(x)).slice(0, 10);
  }, [lab.media, sort]);

  const maxMonth = Math.max(1, ...lab.months.map((m) => m.views));
  const bestFormat = [...lab.formats].sort((x, y) => (y.rate ?? 0) - (x.rate ?? 0))[0]?.format;

  const refresh = async () => {
    setBusy(true); setErr(null);
    try { const r = await syncContentNow(orgId); if (!r.ok) setErr(r.error ?? 'No se pudo actualizar.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fin ct">
      <header className="fin-head">
        <div>
          <div className="fin-kicker">Laboratorio de contenido</div>
          <h1>{a?.username ? `@${a.username}` : 'Instagram'}</h1>
        </div>
        {a && (
          <div className="fin-head-actions">
            <span className="fin-muted">Actualizado {ago(a.last_sync_at)}</span>
            <button className="fin-btn" onClick={refresh} disabled={busy}>{busy ? 'Leyendo Instagram…' : 'Actualizar'}</button>
            <button className="fin-btn" onClick={async () => { if (confirm('¿Desconectar Instagram? Las métricas guardadas quedan.')) await disconnectInstagram(orgId); }}>Desconectar</button>
          </div>
        )}
      </header>

      {notice && <div className={`ct-notice ${noticeKind}`} role="status">{notice}</div>}
      {(err || a?.last_error) && <div className="ct-notice err" role="alert">Instagram respondió: {err ?? a?.last_error}</div>}

      {!a ? (
        <section className="fin-card ct-connect">
          <div>
            <h2>Conectá tu Instagram</h2>
            <p className="fin-muted">
              {staff ? `Cuando ${orgName} conecte su cuenta (o la conectes vos con su acceso)` : 'Cuando conectes tu cuenta'}, vas a ver acá qué contenido trae vistas, cuál trae seguidores y cuál genera conversaciones, mes a mes.
            </p>
            <ul className="ct-steps">
              <li>La cuenta tiene que ser <b>profesional</b> (creador o empresa).</li>
              <li>Solo leemos métricas. No publicamos ni cambiamos nada.</li>
              <li>Podés desconectarla cuando quieras desde esta misma pantalla.</li>
            </ul>
            {ready
              ? <a className="btn primary" href={connectHref}>Conectar Instagram</a>
              : <span className="tag">La conexión se está habilitando</span>}
          </div>
        </section>
      ) : (
        <>
          <section className="fin-kpis ct-kpis">
            <div className="fin-card fin-kpi">
              <div className="fin-label">Seguidores</div>
              <div className="fin-kpi-v"><Count value={lab.followers.now ?? 0} format={fmt} /></div>
              <span className="fin-delta up">{lab.followers.delta30 != null ? `${lab.followers.delta30 >= 0 ? '+' : ''}${fmt(lab.followers.delta30)} en 30 días` : 'La evolución arranca desde la conexión'}</span>
            </div>
            {([
              ['Vistas', 'views'], ['Alcance', 'reach'], ['Interacciones', 'interactions'], ['Seguidores generados', 'follows'],
            ] as [string, keyof Window][]).map(([l, k]) => (
              <div key={k} className="fin-card fin-kpi">
                <div className="fin-label">{l}</div>
                <div className="fin-kpi-v"><Count value={lab.last30[k]} /></div>
                <Delta now={lab.last30[k]} prev={lab.prev30[k]} />
              </div>
            ))}
          </section>
          <p className="fin-foot" style={{ marginTop: -4 }}>Últimos 30 días, sumando las {lab.last30.posts} piezas publicadas en ese período. Instagram puede tardar hasta 48 h en consolidar los números.</p>

          <section className="fin-two">
            <div className="fin-card">
              <div className="fin-label"><span>Mes a mes</span><i /><span className="fin-legend"><span><i style={{ background: 'var(--brand)' }} />Vistas</span></span></div>
              <div className="fin-bars">
                {lab.months.map((m, i) => (
                  <div key={m.key} className="fin-bar-col" title={`${m.posts} piezas · ${fmt(m.views)} vistas · ${fmt(m.reach)} alcance`}>
                    <span className="fin-bar-val">{m.views ? kfmt(m.views) : '—'}</span>
                    <span className="fin-bar-pair"><span className="fin-bar b" style={{ height: mounted ? `${(m.views / maxMonth) * 100}%` : 0, transitionDelay: `${i * 60}ms`, width: 'min(26px, 50%)' }} /></span>
                    <span className="fin-axis-l">{m.label}</span>
                    <span className="ct-sub">{m.follows ? `+${fmt(m.follows)} seg.` : `${m.posts} piezas`}</span>
                  </div>
                ))}
              </div>
              <p className="fin-foot">Medimos el crecimiento mes a mes: una semana floja se compensa con la siguiente.</p>
            </div>

            <div className="fin-card">
              <div className="fin-label"><span>Qué formato rinde más</span><i /><span className="fin-muted small">últimos 90 días</span></div>
              {lab.formats.length ? (
                <div className="ct-formats">
                  {lab.formats.map((f) => (
                    <div key={f.format} className={f.format === bestFormat ? 'best' : ''}>
                      <div className="ct-f-head"><b>{f.format}</b><span className="fin-muted small">{f.posts} {f.posts === 1 ? 'pieza' : 'piezas'}</span></div>
                      <dl>
                        <dt>Vistas prom.</dt><dd>{kfmt(f.views)}</dd>
                        <dt>Alcance prom.</dt><dd>{kfmt(f.reach)}</dd>
                        <dt>Guardados</dt><dd>{fmt(f.saved)}</dd>
                        <dt>Compartidos</dt><dd>{fmt(f.shares)}</dd>
                        <dt>Interacción</dt><dd>{pct(f.rate)}</dd>
                      </dl>
                      {f.format === bestFormat && <span className="ct-badge">Mejor interacción</span>}
                    </div>
                  ))}
                </div>
              ) : <p className="fin-muted">Todavía no hay piezas en los últimos 90 días.</p>}
            </div>
          </section>

          <section className="fin-card">
            <div className="fin-label"><span>Ranking de piezas</span><i /></div>
            <div className="fin-months" role="group" aria-label="Ordenar por" style={{ marginBottom: 14 }}>
              {SORTS.map((x) => <button key={x.k} className={sort === x.k ? 'on' : ''} onClick={() => setSort(x.k)} aria-pressed={sort === x.k}>{x.l}</button>)}
            </div>
            <ol className="ct-rank">
              {ranked.map((m, i) => (
                <li key={m.id}>
                  <span className="ct-pos">{i + 1}</span>
                  <a className="ct-thumb" href={m.permalink ?? '#'} target="_blank" rel="noreferrer" aria-label="Ver en Instagram">
                    {m.thumbnail ? <img src={m.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span />}
                  </a>
                  <div className="ct-body">
                    <div className="ct-cap">{(m.caption ?? 'Sin texto').split('\n')[0].slice(0, 110)}</div>
                    <div className="fin-muted small">{m.format} · {date(m.posted_at)}</div>
                  </div>
                  <div className="ct-nums">
                    <span className={sort === 'views' ? 'on' : ''}><b>{kfmt(m.views ?? 0)}</b>vistas</span>
                    <span className={sort === 'follows' ? 'on' : ''}><b>{m.follows == null ? '—' : fmt(m.follows)}</b>seguidores</span>
                    <span className={sort === 'saved' ? 'on' : ''}><b>{fmt(m.saved)}</b>guardados</span>
                    <span className={sort === 'shares' ? 'on' : ''}><b>{fmt(m.shares)}</b>compartidos</span>
                    <span className={sort === 'rate' ? 'on' : ''}><b>{pct(m.rate)}</b>interacción</span>
                  </div>
                </li>
              ))}
              {!ranked.length && <li className="fin-muted">Todavía no hay piezas. La primera lectura tarda un par de minutos.</li>}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
