import Link from 'next/link';
import { getGoals, type Goal, type Reward } from '@/lib/goals';
import { setRewardEstado, updateGoalActual } from '@/lib/actions';
import { getAllMilestones, listClients } from '@/lib/data';
import { addDays, getPlanTasks, iso, mondayOf, todayISO } from '@/lib/plan';
import { BRANDS, brandColor } from '@/lib/brands';
import { WeekPlanner } from '@/components/WeekPlanner';

export const metadata = { title: 'Objetivos' };

const AREAS = ['Clientes', 'Marca conjunta', 'Baseline', 'Estructura'];
const BRAND_ORDER = (m: string | null) => { const i = BRANDS.findIndex((b) => b.k === m); return i < 0 ? 99 : i; };
const fmtN = (n: number | null, unidad: string | null) => {
  if (n === null || n === undefined) return '—';
  if (unidad?.startsWith('USD')) return `USD ${n.toLocaleString('es-AR')}`;
  return n.toLocaleString('es-AR');
};
const k = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));
const range = (a: string, b: string) => {
  const f = (s: string, o: Intl.DateTimeFormatOptions) => new Date(s + 'T12:00:00').toLocaleDateString('es-AR', o);
  return a.slice(0, 7) === b.slice(0, 7) ? `${f(a, { day: 'numeric' })} al ${f(b, { day: 'numeric', month: 'long' })}` : `${f(a, { day: 'numeric', month: 'short' })} al ${f(b, { day: 'numeric', month: 'short' })}`;
};
const monthLabel = (ym: string) => { const s = new Date(ym + '-15T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };
const overlaps = (g: Goal, a: string, b: string) => !!g.desde && !!g.hasta && g.desde <= b && g.hasta >= a;

type SP = { v?: string; semana?: string; mes?: string };

export default async function Objetivos({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const v = sp.v ?? 'semana';
  const tabs = [
    { k: 'semana', l: 'Semana' },
    { k: 'mes', l: 'Mes' },
    { k: 'q4', l: 'Q4' },
  ];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Objetivos</h1>
          <p>Primero nuestras marcas: Fractal Consulting, Baseline Creative y el contenido de Mateo y Lorena. Después, Val y Marcela.</p>
        </div>
      </div>
      <nav className="tabs">
        {tabs.map((t) => <Link key={t.k} href={`/panel/objetivos?v=${t.k}`} aria-current={v === t.k ? 'page' : undefined}>{t.l}</Link>)}
      </nav>
      {v === 'q4' ? <Q4View /> : v === 'mes' ? <MonthView mes={sp.mes} /> : <WeekView semana={sp.semana} />}
    </>
  );
}

async function WeekView({ semana }: { semana?: string }) {
  const today = todayISO();
  const from = mondayOf(semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : today);
  const to = addDays(from, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const [{ goals, live }, plan] = await Promise.all([getGoals(), getPlanTasks(from, to)]);
  const weekGoals = goals.filter((g) => g.horizonte === 'Semana' && overlaps(g, from, to)).sort((a, b) => BRAND_ORDER(a.marca) - BRAND_ORDER(b.marca));
  const counters = goals.filter((g) => g.horizonte !== 'Q4' && g.meta && g.unidad !== 'Hito' && overlaps(g, from, to) && g.estado !== 'Pausado');
  const isCurrent = today >= from && today <= to;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: '-.02em' }}>Semana del {range(from, to)}</div>
          {!live && <p className="muted small">Sin conexión con Fractal Goals: se muestran solo las tareas.</p>}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Link className="btn sm" href={`/panel/objetivos?v=semana&semana=${addDays(from, -7)}`} aria-label="Semana anterior">‹</Link>
          {!isCurrent && <Link className="btn sm" href="/panel/objetivos?v=semana">Esta semana</Link>}
          <Link className="btn sm" href={`/panel/objetivos?v=semana&semana=${addDays(from, 7)}`} aria-label="Semana siguiente">›</Link>
        </div>
      </div>
      <WeekPlanner
        days={days}
        today={today}
        tasks={plan.tasks}
        overdue={from <= today ? plan.overdue : []}
        undated={isCurrent ? plan.undated : []}
        goals={weekGoals}
        counters={counters}
      />
    </div>
  );
}

async function MonthView({ mes }: { mes?: string }) {
  const today = todayISO();
  const nextWeekEnd = addDays(mondayOf(today), 6);
  const ym = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : nextWeekEnd.slice(0, 7);
  const first = `${ym}-01`;
  const lastD = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0);
  const last = iso(lastD);
  const weeks: string[] = [];
  for (let w = mondayOf(first); w <= last; w = addDays(w, 7)) weeks.push(w);
  const [{ goals }, plan, milestones, clients] = await Promise.all([
    getGoals(), getPlanTasks(weeks[0], addDays(weeks[weeks.length - 1], 6)), getAllMilestones(), listClients(),
  ]);
  const orgName = new Map(clients.map((c) => [c.id, c.name]));
  const monthGoals = goals.filter((g) => g.horizonte === 'Mes' && overlaps(g, first, last)).sort((a, b) => BRAND_ORDER(a.marca) - BRAND_ORDER(b.marca));
  const prev = iso(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 2, 1)).slice(0, 7);
  const next = iso(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 1)).slice(0, 7);
  return (
    <div className="stack" style={{ gap: 26 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: '-.02em' }}>{monthLabel(ym)}</div>
        <div className="row" style={{ gap: 6 }}>
          <Link className="btn sm" href={`/panel/objetivos?v=mes&mes=${prev}`} aria-label="Mes anterior">‹</Link>
          <Link className="btn sm" href={`/panel/objetivos?v=mes&mes=${next}`} aria-label="Mes siguiente">›</Link>
        </div>
      </div>

      <section>
        <h2 className="section-title">Objetivos del mes</h2>
        {monthGoals.length ? (
          <div className="wk-goals">
            {monthGoals.map((g) => {
              const numeric = g.meta && g.unidad !== 'Hito';
              const pct = numeric ? Math.min(100, ((g.actual ?? 0) / g.meta!) * 100) : 0;
              return (
                <div key={g.id ?? g.title} className={`wk-goal ${g.estado === 'Logrado' ? 'is-done' : ''}`} style={{ ['--c' as string]: brandColor(g.marca) }}>
                  <span className="wk-brand">{g.marca}</span>
                  <span className="wk-goal-title">{g.title}</span>
                  {g.criterio && <p className="muted small wk-crit">{g.criterio}</p>}
                  {numeric ? (
                    <>
                      <div className="wk-num"><b>{(g.actual ?? 0).toLocaleString('es-AR')}</b><span className="muted"> / {g.meta!.toLocaleString('es-AR')} {g.unidad?.toLowerCase()}</span></div>
                      <div className="bar"><span style={{ width: `${pct}%`, background: 'var(--c)' }} /></div>
                    </>
                  ) : (
                    <span className={`tag ${g.estado === 'Logrado' ? 'ok' : g.estado === 'En curso' ? 'brand' : ''}`} style={{ marginTop: 'auto', width: 'fit-content' }}>{g.estado}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : <div className="panel empty">Todavía no hay objetivos para este mes en Fractal Goals.</div>}
      </section>

      <section>
        <h2 className="section-title">Semana por semana</h2>
        <div className="stack" style={{ gap: 10 }}>
          {weeks.map((w) => {
            const end = addDays(w, 6);
            const wg = goals.filter((g) => g.horizonte === 'Semana' && overlaps(g, w, end)).sort((a, b) => BRAND_ORDER(a.marca) - BRAND_ORDER(b.marca));
            const hitos = milestones.filter((m) => m.due_date && m.due_date >= w && m.due_date <= end);
            const tk = plan.tasks.filter((t) => t.due_date && t.due_date >= w && t.due_date <= end);
            const ok = tk.filter((t) => t.done).length;
            const current = today >= w && today <= end;
            return (
              <Link key={w} href={`/panel/objetivos?v=semana&semana=${w}`} className={`panel mo-week ${current ? 'now' : ''}`}>
                <div className="mo-when">
                  <b>{range(w, end)}</b>
                  {current && <span className="tag brand">Esta semana</span>}
                  <span className="muted small" style={{ fontVariantNumeric: 'tabular-nums' }}>{tk.length ? `${ok}/${tk.length} tareas` : 'sin tareas'}</span>
                  {tk.length > 0 && <div className="bar" style={{ width: 90 }}><span style={{ width: `${(ok / tk.length) * 100}%` }} /></div>}
                </div>
                <ul className="mo-goals">
                  {wg.map((g) => (
                    <li key={g.id ?? g.title} className={g.estado === 'Logrado' ? 'is-done' : ''}>
                      <i style={{ background: brandColor(g.marca) }} />{g.title}
                    </li>
                  ))}
                  {hitos.map((m) => (
                    <li key={m.id} className="mo-hito">
                      <span>◆</span>{m.title}<em>{orgName.get(m.org_id) ?? ''} · {new Date(m.due_date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</em>
                    </li>
                  ))}
                  {!wg.length && !hitos.length && <li className="muted">Sin objetivos cargados para esta semana.</li>}
                </ul>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

async function Q4View() {
  const { goals: all, rewards, live } = await getGoals();
  const goals = all.filter((g) => g.horizonte === 'Q4');
  const brandGoals = goals.filter((g) => g.marca && g.marca !== 'Fractal' && g.estado !== 'Pausado');
  const active = goals.filter((g) => g.estado !== 'Pausado');
  const done = active.filter((g) => g.estado === 'Logrado').length;
  const unlocked = rewards.filter((r) => r.estado === 'Desbloqueada' || r.estado === 'Adquirida').length;

  // Escalera de facturación FRACTAL
  const ladder = active
    .filter((g) => g.unidad === 'USD' && /facturaci/i.test(g.title) && g.area === 'Clientes' && g.meta)
    .sort((a, b) => a.meta! - b.meta!);
  const top = ladder[ladder.length - 1]?.meta ?? 1;
  const billed = Math.max(0, ...ladder.map((g) => g.actual ?? 0));
  const rewardFor = (meta: number) => {
    const n = meta.toLocaleString('es-AR');
    return rewards.filter((r) => r.hito?.includes(n) || r.hito?.includes(`${meta / 1000}k`) || r.title.includes(n));
  };

  if (!live) {
    return (
      <>
        <div className="panel panel-pad stack" style={{ gap: 8, maxWidth: 620 }}>
          <b style={{ fontWeight: 500 }}>Falta darle acceso a Fractal Goals</b>
          <p className="muted small">En Notion, abrí la página <b>Fractal</b> → ••• → Conexiones → agregá <b>Fractal OS</b>. Con eso se ven acá el Scoreboard y el Rewards Tracker de Q4, y se pueden actualizar.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="row" style={{ gap: 24, justifyContent: 'flex-end', marginBottom: 18 }}>
          <Counter n={done} of={active.length} label="metas logradas" />
          <Counter n={unlocked} of={rewards.length} label="recompensas desbloqueadas" />
      </div>

      {brandGoals.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 className="section-title">Foco del trimestre · marcas</h2>
          <div className="wk-goals">
            {[...brandGoals].sort((a, b) => BRAND_ORDER(a.marca) - BRAND_ORDER(b.marca)).map((g) => (
              <div key={g.id ?? g.title} className={`wk-goal ${g.estado === 'Logrado' ? 'is-done' : ''}`} style={{ ['--c' as string]: brandColor(g.marca) }}>
                <span className="wk-brand">{g.marca}</span>
                <span className="wk-goal-title">{g.title}</span>
                {g.criterio && <p className="muted small wk-crit">{g.criterio}</p>}
                <span className={`tag ${g.estado === 'Logrado' ? 'ok' : g.estado === 'En curso' ? 'brand' : ''}`} style={{ marginTop: 'auto', width: 'fit-content' }}>{g.estado}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {ladder.length > 0 && (
        <section className="panel panel-pad" style={{ marginBottom: 28 }}>
          <div className="row between wrap" style={{ marginBottom: 22 }}>
            <div>
              <div className="muted small">Escalera de facturación FRACTAL</div>
              <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: '-.02em', marginTop: 2 }}>
                {billed ? `USD ${billed.toLocaleString('es-AR')}` : 'Sin facturación cargada'}
              </div>
            </div>
            <span className="muted small">Próximo escalón: {ladder.find((g) => (g.actual ?? 0) < g.meta!)?.title ?? 'todos alcanzados'}</span>
          </div>
          <div className="ladder">
            <div className="ladder-track"><span style={{ width: `${Math.min(100, (billed / top) * 100)}%` }} /></div>
            {ladder.map((g) => {
              const reached = billed >= g.meta! || g.estado === 'Logrado';
              return (
                <div key={g.title} className={`ladder-step ${reached ? 'on' : ''}`} style={{ left: `${(g.meta! / top) * 100}%` }}>
                  <i />
                  <b>{k(g.meta!)}</b>
                  <span>{rewardFor(g.meta!).map((r) => r.title.split(' — ')[0]).join(' + ') || '—'}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="two">
        <section className="stack" style={{ gap: 22 }}>
          {AREAS.map((area) => {
            const list = goals.filter((g) => g.area === area && !brandGoals.includes(g));
            if (!list.length) return null;
            return (
              <div key={area}>
                <h2 className="section-title">{area}</h2>
                <ul className="list panel">{list.map((g) => <GoalRow key={g.title} g={g} live={live} />)}</ul>
              </div>
            );
          })}
        </section>
        <section>
          <h2 className="section-title">Recompensas</h2>
          <div className="stack" style={{ gap: 8 }}>{rewards.map((r) => <RewardCard key={r.title} r={r} live={live} />)}</div>
          <p className="muted small" style={{ marginTop: 12 }}>Una recompensa desbloqueada no es una compra: antes se valida caja y presupuesto.</p>
        </section>
      </div>
    </>
  );
}

function Counter({ n, of, label }: { n: number; of: number; label: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: '-.03em' }}>{n}<span className="muted" style={{ fontSize: 15 }}> / {of}</span></div>
      <div className="muted small">{label}</div>
    </div>
  );
}

function GoalRow({ g, live }: { g: Goal; live: boolean }) {
  const pct = g.meta && g.actual !== null ? Math.min(100, (g.actual / g.meta) * 100) : 0;
  const binary = g.unidad === 'Hito';
  return (
    <li className={`goal ${g.estado === 'Pausado' ? 'paused' : ''}`}>
      <div className="row between" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="grow">
          <div>{g.title}</div>
          {g.criterio && <div className="muted small goal-crit">{g.criterio}</div>}
        </div>
        <span className={`tag ${g.estado === 'Logrado' ? 'ok' : g.estado === 'En curso' ? 'brand' : ''}`}>{g.estado}</span>
      </div>
      {!binary && (
        <div className="row" style={{ gap: 12, marginTop: 10 }}>
          <div className="bar grow"><span style={{ width: `${pct}%` }} /></div>
          <span className="muted small" style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {fmtN(g.actual, g.unidad)} / {fmtN(g.meta, g.unidad)}
          </span>
        </div>
      )}
      {live && g.id && g.estado !== 'Pausado' && (
        <details className="goal-edit">
          <summary className="muted small">Actualizar</summary>
          <form action={updateGoalActual} className="row wrap" style={{ gap: 8, marginTop: 8 }}>
            <input type="hidden" name="id" value={g.id} />
            {!binary && <input className="input" name="actual" inputMode="decimal" defaultValue={g.actual ?? ''} placeholder="Valor actual" style={{ width: 140 }} />}
            {binary && <input type="hidden" name="actual" value={g.actual ?? 0} />}
            <select className="select" name="estado" defaultValue={g.estado} style={{ width: 140 }}>
              {['Por definir', 'En curso', 'Logrado', 'Pausado'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <button className="btn sm">Guardar</button>
          </form>
        </details>
      )}
    </li>
  );
}

function RewardCard({ r, live }: { r: Reward; live: boolean }) {
  const open = r.estado === 'Desbloqueada' || r.estado === 'Adquirida';
  return (
    <div className={`panel reward ${open ? 'on' : ''}`}>
      <span className="reward-lock" aria-hidden="true">{open ? '◆' : '◇'}</span>
      <div className="grow">
        <div className="row between" style={{ gap: 8 }}>
          <b style={{ fontWeight: 500 }}>{r.title}</b>
          <span className={`tag ${open ? 'ok' : ''}`}>{r.estado}</span>
        </div>
        {r.hito && <div className="muted small" style={{ marginTop: 3 }}>{r.hito}</div>}
        {live && r.id && r.estado === 'Bloqueada' && (
          <form action={setRewardEstado.bind(null, r.id, 'Desbloqueada')} style={{ marginTop: 8 }}>
            <button className="btn ghost sm" style={{ paddingLeft: 0 }}>Marcar desbloqueada</button>
          </form>
        )}
      </div>
    </div>
  );
}
