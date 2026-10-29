import { getGoals, type Goal, type Reward } from '@/lib/goals';
import { setRewardEstado, updateGoalActual } from '@/lib/actions';

export const metadata = { title: 'Objetivos' };

const AREAS = ['Clientes', 'Marca conjunta', 'Baseline', 'Estructura'];
const fmtN = (n: number | null, unidad: string | null) => {
  if (n === null || n === undefined) return '—';
  if (unidad?.startsWith('USD')) return `USD ${n.toLocaleString('es-AR')}`;
  return n.toLocaleString('es-AR');
};
const k = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));

export default async function Objetivos() {
  const { goals, rewards, live } = await getGoals();
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Objetivos · Q4 2026</h1>
          <p>Octubre a diciembre. Cada meta se marca como lograda solo con evidencia.</p>
        </div>
        <div className="row" style={{ gap: 24 }}>
          <Counter n={done} of={active.length} label="metas logradas" />
          <Counter n={unlocked} of={rewards.length} label="recompensas desbloqueadas" />
        </div>
      </div>
      {!live && (
        <div className="panel panel-pad stack" style={{ gap: 8, maxWidth: 620, marginBottom: 18 }}>
          <b style={{ fontWeight: 500 }}>Falta darle acceso a Fractal Goals</b>
          <p className="muted small">En Notion, abrí la página <b>Fractal</b> → ••• → Conexiones → agregá <b>Fractal OS</b>. Con eso se ven acá el Scoreboard y el Rewards Tracker de Q4, y se pueden actualizar.</p>
        </div>
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
            const list = goals.filter((g) => g.area === area);
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
