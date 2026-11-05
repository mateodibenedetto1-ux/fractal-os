'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { refreshFinance } from '@/lib/finance-actions';
import type { FinanceData, Month } from '@/lib/finance';
import { Cube } from './Mark';

/** Paleta de Fractal OS (se adapta a modo claro y oscuro). */
const C = { billed: 'var(--brand)', cash: 'var(--ok)', team: 'var(--brand)', soft: 'var(--focus)', fees: 'var(--warn)', grey: 'var(--muted)', neg: 'var(--brand)', ink: 'var(--ink)' };
const CAT = [
  { k: 'team', l: 'Equipo', c: C.team },
  { k: 'software', l: 'Software', c: C.soft },
  { k: 'fees', l: 'Comisiones', c: C.fees },
  { k: 'other', l: 'Otros', c: C.grey },
] as const;

const usd = (n: number, d = 0) => (n < 0 ? '–' : '') + '$' + Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const kfmt = (n: number) => (Math.abs(n) >= 1000 ? `${n < 0 ? '–' : ''}$${(Math.abs(n) / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}K` : usd(n));
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);

function useReduced() {
  const [r, setR] = useState(false);
  useEffect(() => { setR(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  return r;
}

/** Número que sube desde 0 (o desde el valor anterior) con easing. */
function Count({ value, format = usd, ms = 1400 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  const reduced = useReduced();
  useEffect(() => {
    if (reduced) { setV(value); return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - p, 4);
      setV(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, reduced]);
  return <>{format(v)}</>;
}

function useMounted(delay = 60) {
  const [m, setM] = useState(false);
  useEffect(() => { const t = setTimeout(() => setM(true), delay); return () => clearTimeout(t); }, [delay]);
  return m;
}

function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="fin-label">
      <span>{children}</span>
      <i />
      {right}
    </div>
  );
}

function Delta({ now, prev, invert }: { now: number; prev: number | undefined; invert?: boolean }) {
  if (prev == null || prev === 0) return null;
  const d = (now - prev) / Math.abs(prev);
  const good = invert ? d <= 0 : d >= 0;
  return <span className={`fin-delta ${good ? 'up' : 'down'}`}>{d >= 0 ? '↑' : '↓'} {Math.abs(Math.round(d * 100))}% vs. mes anterior</span>;
}

// ---------- Gráficos ----------

/** Acumulado del año: facturado y cobrado, como área con brillo. */
function Cumulative({ months }: { months: Month[] }) {
  const mounted = useMounted(120);
  const pts = useMemo(() => {
    let b = 0, c = 0;
    return months.map((m) => ({ label: m.label, b: (b += m.billed), c: (c += m.cash) }));
  }, [months]);
  const W = 520, H = 190, P = 26;
  const max = Math.max(1, ...pts.map((p) => p.b)) * 1.08;
  const x = (i: number) => P + (i * (W - P * 2)) / Math.max(1, pts.length - 1);
  const y = (v: number) => H - 24 - (v / max) * (H - 48);
  const line = (k: 'b' | 'c') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const area = (k: 'b' | 'c') => `${line(k)} L${x(pts.length - 1)},${H - 24} L${x(0)},${H - 24} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`fin-svg ${mounted ? 'on' : ''}`} role="img" aria-label="Acumulado facturado y cobrado del año">
      <defs>
        <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: C.billed, stopOpacity: 0.16 }} /><stop offset="1" style={{ stopColor: C.billed, stopOpacity: 0 }} /></linearGradient>
        <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: C.cash, stopOpacity: 0.2 }} /><stop offset="1" style={{ stopColor: C.cash, stopOpacity: 0 }} /></linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={P} x2={W - P} y1={y(max * f / 1.08)} y2={y(max * f / 1.08)} className="fin-grid" />)}
      <path d={area('b')} fill="url(#gB)" className="fin-area" />
      <path d={area('c')} fill="url(#gC)" className="fin-area" />
      <path d={line('b')} style={{ stroke: C.billed }} className="fin-line" />
      <path d={line('c')} style={{ stroke: C.cash }} className="fin-line" />
      {pts.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.c)} r="3.2" className="fin-dot" style={{ fill: 'var(--surface)', stroke: C.cash, strokeWidth: 2, animationDelay: `${0.5 + i * 0.08}s` }} />
          <text x={x(i)} y={H - 6} className="fin-axis" textAnchor="middle">{p.label}</text>
        </g>
      ))}
      {pts.length > 0 && (
        <text x={x(pts.length - 1)} y={y(pts[pts.length - 1].b) - 10} className="fin-tip" textAnchor="end" style={{ fill: C.billed }}>{kfmt(pts[pts.length - 1].b)}</text>
      )}
    </svg>
  );
}

/** Facturado vs cobrado por mes. */
function Bars({ months, sel, onSel }: { months: Month[]; sel: string; onSel: (k: string) => void }) {
  const mounted = useMounted(80);
  const max = Math.max(1, ...months.map((m) => Math.max(m.billed, m.cash)));
  return (
    <div className="fin-bars" role="group" aria-label="Facturado y cobrado por mes">
      {months.map((m, i) => (
        <button key={m.key} className={`fin-bar-col ${m.key === sel ? 'on' : ''} ${m.tab ? '' : 'empty'}`} onClick={() => m.tab && onSel(m.key)} disabled={!m.tab} title={m.tab ? `${m.name}: facturado ${usd(m.billed)} · cobrado ${usd(m.cash)}` : `${m.name}: sin pestaña`}>
          <span className="fin-bar-val">{m.tab ? kfmt(m.billed) : '—'}</span>
          <span className="fin-bar-pair">
            <span className="fin-bar b" style={{ height: mounted ? `${(m.billed / max) * 100}%` : 0, transitionDelay: `${i * 60}ms` }} />
            <span className="fin-bar c" style={{ height: mounted ? `${(m.cash / max) * 100}%` : 0, transitionDelay: `${i * 60 + 80}ms` }} />
          </span>
          <span className="fin-axis-l">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Cascada del mes: cobrado → gastos → profit → caja chica → repartible. */
function Waterfall({ m }: { m: Month }) {
  const mounted = useMounted(60);
  const steps = [
    { l: 'Cobrado', v: m.cash, kind: 'total', c: C.cash },
    { l: 'Equipo', v: -m.team, kind: 'step', c: C.team },
    { l: 'Software', v: -m.software, kind: 'step', c: C.soft },
    { l: 'Comis.', v: -(m.fees + m.other), kind: 'step', c: C.fees },
    { l: 'Profit', v: m.profit, kind: 'total', c: m.profit >= 0 ? C.cash : C.neg },
    { l: 'Caja', v: -m.pettyCash, kind: 'step', c: C.grey },
    { l: 'Repartible', v: m.distributable, kind: 'total', c: m.distributable >= 0 ? C.cash : C.neg },
  ];
  const top = Math.max(1, m.cash, m.profit);
  const bottom = Math.min(0, m.profit, m.distributable);
  const span = top - bottom;
  let run = 0;
  return (
    <div className="fin-wf" role="img" aria-label={`Cascada de ${m.name}`}>
      {steps.map((s, i) => {
        let lo: number, hi: number;
        if (s.kind === 'total') { lo = Math.min(0, s.v); hi = Math.max(0, s.v); run = s.v; }
        else { hi = run; lo = run + s.v; run = lo; }
        const h = ((hi - lo) / span) * 100;
        const b = ((lo - bottom) / span) * 100;
        return (
          <div key={s.l} className="fin-wf-col">
            <div className="fin-wf-track">
              <span className={`fin-wf-bar ${s.kind}`} style={{ bottom: `${b}%`, height: mounted ? `${Math.max(h, 0.8)}%` : 0, background: s.c, transitionDelay: `${i * 90}ms` }} />
            </div>
            <span className="fin-wf-v" style={{ color: s.kind === 'total' ? s.c : undefined }}>{s.kind === 'step' && s.v ? '–' : ''}{kfmt(Math.abs(s.v))}</span>
            <span className="fin-axis-l">{s.l}</span>
          </div>
        );
      })}
    </div>
  );
}

function Ring({ value, size = 92, color = C.cash }: { value: number; size?: number; color?: string }) {
  const mounted = useMounted(200);
  const r = size / 2 - 7, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="fin-ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="fin-ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} strokeDasharray={c} strokeDashoffset={mounted ? c * (1 - Math.min(1, value)) : c} className="fin-ring-fg" style={{ stroke: color }} />
    </svg>
  );
}

/** Gastos por mes, apilados por categoría. */
function Spend({ months }: { months: Month[] }) {
  const mounted = useMounted(100);
  const max = Math.max(1, ...months.map((m) => m.direct));
  return (
    <div className="fin-stack">
      {months.map((m, i) => (
        <div key={m.key} className="fin-stack-col" title={`${m.name}: ${usd(m.direct)}`}>
          <span className="fin-bar-val">{m.tab ? kfmt(m.direct) : '—'}</span>
          <span className="fin-stack-bar" style={{ height: mounted ? `${(m.direct / max) * 100}%` : 0, transitionDelay: `${i * 60}ms` }}>
            {CAT.map((c) => m[c.k] > 0 && <span key={c.k} style={{ flexGrow: m[c.k], background: c.c }} />)}
          </span>
          <span className="fin-axis-l">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Dashboard ----------

export function FinanceDashboard({ data }: { data: FinanceData }) {
  const withData = data.months.filter((m) => m.tab);
  const last = withData[withData.length - 1];
  // Por defecto el último mes con cobros (el mes en curso suele estar sin cobrar todavía)
  const closed = [...withData].reverse().find((x) => x.cash > 0) ?? last;
  const [sel, setSel] = useState(closed?.key ?? '');
  const [busy, setBusy] = useState(false);
  const m = data.months.find((x) => x.key === sel) ?? last;
  const prev = m ? withData[withData.findIndex((x) => x.key === m.key) - 1] : undefined;
  const t = data.totals;
  const collected = t.billed ? t.cash / t.billed : 0;
  const maxClient = Math.max(1, ...data.clients.map((c) => c.billed));
  const pendings = withData.flatMap((x) => x.incomes.filter((i) => i.pending).map((i) => ({ ...i, month: x.name })));
  const catTotals = CAT.map((c) => ({ ...c, v: t[c.k] }));
  const catSum = Math.max(1, catTotals.reduce((s, c) => s + c.v, 0));

  return (
    <div className="fin">
      <header className="fin-head">
        <div>
          <div className="fin-kicker"><Cube size={14} /> Fractal · {data.year}</div>
          <h1>Finanzas</h1>
        </div>
        <div className="fin-head-actions">
          <span className="fin-muted">Actualizado {new Date(data.updatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
          <button className="fin-btn" disabled={busy} onClick={async () => { setBusy(true); try { await refreshFinance(); } finally { setBusy(false); } }}>{busy ? 'Leyendo…' : 'Actualizar'}</button>
          {data.sheetUrl && <a className="fin-btn" href={data.sheetUrl} target="_blank" rel="noreferrer">Abrir planilla ↗</a>}
        </div>
      </header>

      <section className="fin-hero fin-card">
        <div className="fin-hero-main">
          <Label>Facturado acumulado {data.year}</Label>
          <div className="fin-big"><Count value={t.billed} ms={1800} /></div>
          <div className="fin-hero-sub">
            <span><b style={{ color: C.cash }}><Count value={t.cash} /></b> cobrado</span>
            <span><b style={{ color: C.billed }}><Count value={t.pending} /></b> pendiente de cobro</span>
            <span><b><Count value={t.distributable} /></b> profit repartible</span>
          </div>
          <div className="fin-ring-row">
            <div className="fin-ring-wrap">
              <Ring value={collected} />
              <span><Count value={collected * 100} format={(n) => `${Math.round(n)}%`} /></span>
            </div>
            <div>
              <div className="fin-muted small">de lo facturado ya está cobrado</div>
              <div className="fin-muted small">Margen del año: <b style={{ color: C.cash }}>{pct(t.margin)}</b></div>
            </div>
          </div>
        </div>
        <div className="fin-hero-chart">
          <Label right={<span className="fin-legend"><i style={{ background: C.billed }} />Facturado <i style={{ background: C.cash }} />Cobrado</span>}>Acumulado del año</Label>
          <Cumulative months={data.months} />
        </div>
      </section>

      {m && (
        <>
          <nav className="fin-months" aria-label="Mes">
            {withData.map((x) => (
              <button key={x.key} className={x.key === m.key ? 'on' : ''} onClick={() => setSel(x.key)} aria-pressed={x.key === m.key}>{x.label}</button>
            ))}
          </nav>
          <section className="fin-kpis" key={m.key}>
            {[
              { l: 'Facturación', v: m.billed, p: prev?.billed, c: C.billed },
              { l: 'Cash collected', v: m.cash, p: prev?.cash, c: C.cash },
              { l: 'Gastos directos', v: m.direct, p: prev?.direct, c: C.ink, invert: true },
              { l: 'Profit repartible', v: m.distributable, p: prev?.distributable, c: m.distributable >= 0 ? C.cash : C.neg },
            ].map((k) => (
              <div key={k.l} className="fin-card fin-kpi" style={{ ['--k' as string]: k.c }}>
                <Label>{k.l}</Label>
                <div className="fin-kpi-v" style={{ color: k.c }}><Count value={k.v} ms={900} /></div>
                <Delta now={k.v} prev={k.p} invert={k.invert} />
              </div>
            ))}
            <div className="fin-card fin-kpi">
              <Label>Margen</Label>
              <div className="fin-kpi-v"><Count value={(m.margin ?? 0) * 100} ms={900} format={(n) => (m.margin == null ? '—' : `${Math.round(n)}%`)} /></div>
              <span className="fin-muted small">{m.pending > 0 ? `${usd(m.pending)} pendiente de cobro` : 'Todo cobrado'}</span>
            </div>
          </section>

          <section className="fin-two">
            <div className="fin-card">
              <Label right={<span className="fin-legend"><i style={{ background: C.billed }} />Facturado <i style={{ background: C.cash }} />Cobrado</span>}>Facturado y cobrado</Label>
              <Bars months={data.months} sel={m.key} onSel={setSel} />
            </div>
            <div className="fin-card">
              <Label right={<span className="fin-muted small">{m.name}</span>}>Cascada del mes</Label>
              <Waterfall m={m} />
            </div>
          </section>
        </>
      )}

      <section className="fin-two">
        <div className="fin-card">
          <Label right={<span className="fin-legend">{CAT.map((c) => <span key={c.k}><i style={{ background: c.c }} />{c.l}</span>)}</span>}>Gastos del negocio</Label>
          <Spend months={data.months} />
          <div className="fin-split">
            {catTotals.map((c) => (
              <div key={c.k}>
                <span className="fin-muted small">{c.l}</span>
                <b style={{ color: c.c }}>{usd(c.v)}</b>
                <span className="fin-meter"><span style={{ width: `${(c.v / catSum) * 100}%`, background: c.c }} /></span>
              </div>
            ))}
          </div>
        </div>
        <div className="fin-card">
          <Label>Software</Label>
          <ul className="fin-list">
            {data.topSoftware.map((s) => (
              <li key={s.name}><span>{s.name}</span><b>{usd(s.amount)}</b></li>
            ))}
            {!data.topSoftware.length && <li className="fin-muted">Sin gastos de software.</li>}
          </ul>
          {m && (
            <>
              <Label right={<span className="fin-muted small">{m.name}</span>}>Gastos del mes</Label>
              <ul className="fin-list compact">
                {m.expenses.slice(0, 8).map((e, i) => (
                  <li key={i}><span>{e.detail} <em>{e.category}</em></span><b>{usd(e.amount)}</b></li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section className="fin-two">
        <div className="fin-card">
          <Label>Clientes por facturación</Label>
          <ul className="fin-clients">
            {data.clients.map((c, i) => (
              <li key={c.name}>
                <div className="fin-client-row">
                  <span>{c.name} <em>{c.tag}</em></span>
                  <b>{usd(c.billed)}</b>
                </div>
                <span className="fin-meter big"><span style={{ width: `${(c.billed / maxClient) * 100}%`, transitionDelay: `${i * 70}ms` }} /></span>
                <span className="fin-muted small">{c.months} {c.months === 1 ? 'mes' : 'meses'} · cobrado {usd(c.cash)}{c.pending ? ` · pendiente ${usd(c.pending)}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="fin-card">
          <Label>Pendiente de cobro</Label>
          <ul className="fin-list">
            {pendings.map((p, i) => (
              <li key={i}><span>{p.client} <em>{p.month}</em></span><b style={{ color: 'var(--warn)' }}>{usd(p.billed)}</b></li>
            ))}
            {!pendings.length && <li className="fin-muted">No hay cobros pendientes.</li>}
          </ul>
          <Label>Trimestres {data.year}</Label>
          <div className="fin-q">
            {data.quarters.map((qq) => (
              <div key={qq.q} className={qq.months ? '' : 'off'}>
                <span className="fin-q-name">{qq.q}</span>
                <b>{qq.months ? kfmt(qq.billed) : '—'}</b>
                {qq.months ? (
                  <>
                    <span className="fin-muted small">cobrado {kfmt(qq.cash)}</span>
                    <span className="fin-muted small">profit {kfmt(qq.profit)}</span>
                  </>
                ) : <span className="fin-muted small">sin datos</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="fin-foot">Espejo del negocio en "Tabla de Finanzas FRACTAL": ingresos y gastos con Quién = Negocio. Profit = cobrado − gastos directos; caja chica {Math.round(data.pettyPct * 100)}% del profit.</p>
    </div>
  );
}
