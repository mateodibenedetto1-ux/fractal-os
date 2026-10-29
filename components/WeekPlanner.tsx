'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { setGoalEstado, toggleAction, updateGoalActual } from '@/lib/actions';
import { BRANDS, brandColor } from '@/lib/brands';
import type { Goal } from '@/lib/goals';
import type { PlanTask } from '@/lib/plan';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PEOPLE = ['Mateo', 'Lorena'];
const dayNum = (s: string) => Number(s.slice(8, 10));
const short = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

interface Props {
  days: string[];
  today: string;
  tasks: PlanTask[];
  overdue: PlanTask[];
  undated: PlanTask[];
  goals: Goal[];
  counters: Goal[];
}

export function WeekPlanner({ days, today, tasks, overdue, undated, goals, counters }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [goalDone, setGoalDone] = useState<Record<string, boolean>>({});
  const [brand, setBrand] = useState<string>('Todas');
  const [person, setPerson] = useState<string>('Todos');
  const [, start] = useTransition();

  const isDone = (t: PlanTask) => done[t.id] ?? t.done;
  const toggle = (t: PlanTask) => {
    const next = !isDone(t);
    setDone((d) => ({ ...d, [t.id]: next }));
    start(async () => {
      try {
        await toggleAction(t.id, next);
      } catch {
        setDone((d) => ({ ...d, [t.id]: !next }));
      }
    });
  };
  const toggleGoal = (g: Goal) => {
    if (!g.id) return;
    const next = !(goalDone[g.id] ?? g.estado === 'Logrado');
    setGoalDone((d) => ({ ...d, [g.id!]: next }));
    start(() => setGoalEstado(g.id!, next ? 'Logrado' : 'En curso'));
  };

  const match = (t: PlanTask) =>
    (brand === 'Todas' || t.brand === brand) &&
    (person === 'Todos' || !t.responsable || t.responsable === 'Fractal' || t.responsable.includes(person));
  const visible = tasks.filter(match);
  const late = overdue.filter(match);
  const noDate = undated.filter(match);
  const brandsHere = useMemo(() => BRANDS.filter((b) => tasks.some((t) => t.brand === b.k) || goals.some((g) => g.marca === b.k)), [tasks, goals]);
  const total = visible.length;
  const closed = visible.filter(isDone).length;

  return (
    <div className="stack" style={{ gap: 22 }}>
      {(goals.length > 0 || counters.length > 0) && (
        <section>
          <h2 className="section-title">Objetivos de la semana</h2>
          <div className="wk-goals">
            {counters.map((g) => <CounterCard key={g.id ?? g.title} g={g} />)}
            {goals.map((g) => {
              const own = tasks.filter((t) => t.brand === g.marca);
              const ok = own.filter(isDone).length;
              const achieved = g.id ? goalDone[g.id] ?? g.estado === 'Logrado' : g.estado === 'Logrado';
              return (
                <div key={g.id ?? g.title} className={`wk-goal ${achieved ? 'is-done' : ''} ${brand === g.marca ? 'sel' : ''}`} style={{ ['--c' as string]: brandColor(g.marca) }}>
                  <div className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
                    <button className="wk-goal-body" onClick={() => setBrand(brand === g.marca ? 'Todas' : g.marca ?? 'Todas')} aria-pressed={brand === g.marca}>
                      <span className="wk-brand">{g.marca}</span>
                      <span className="wk-goal-title">{g.title.replace(/^[^:]+:\s*/, '')}</span>
                    </button>
                    <input type="checkbox" className="check" checked={achieved} onChange={() => toggleGoal(g)} aria-label="Objetivo logrado" />
                  </div>
                  {g.criterio && <p className="muted small wk-crit">{g.criterio}</p>}
                  <div className="row" style={{ gap: 8, marginTop: 'auto' }}>
                    <div className="bar grow"><span style={{ width: `${own.length ? (ok / own.length) * 100 : 0}%`, background: 'var(--c)' }} /></div>
                    <span className="muted small" style={{ fontVariantNumeric: 'tabular-nums' }}>{own.length ? `${ok}/${own.length} tareas` : 'sin tareas'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="row between wrap" style={{ gap: 10 }}>
        <div className="chips" role="group" aria-label="Marca">
          <button className={`chip ${brand === 'Todas' ? 'on' : ''}`} onClick={() => setBrand('Todas')}>Todas</button>
          {brandsHere.map((b) => (
            <button key={b.k} className={`chip ${brand === b.k ? 'on' : ''}`} onClick={() => setBrand(b.k)}>
              <i style={{ background: b.color }} /> {b.k}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="chips" role="group" aria-label="Persona">
            {['Todos', ...PEOPLE].map((p) => (
              <button key={p} className={`chip ${person === p ? 'on' : ''}`} onClick={() => setPerson(p)}>{p}</button>
            ))}
          </div>
          <span className="muted small" style={{ fontVariantNumeric: 'tabular-nums' }}>{closed} de {total} hechas</span>
        </div>
      </div>

      {late.length > 0 && (
        <details className="panel wk-late">
          <summary><b>Quedaron atrás</b> <span className="muted">· {late.filter((t) => !isDone(t)).length}</span><span className="muted small" style={{ marginLeft: 'auto' }}>Abrir</span></summary>
          <ul className="wk-list">{late.map((t) => <TaskRow key={t.id} t={t} done={isDone(t)} onToggle={() => toggle(t)} showDate />)}</ul>
        </details>
      )}

      <div className="wk-grid">
        {days.map((d, i) => {
          const list = visible.filter((t) => t.due_date === d);
          return (
            <section key={d} className={`wk-day ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}`}>
              <header>
                <span>{DOW[i]}</span>
                <b>{dayNum(d)}</b>
                {list.length > 0 && <em>{list.filter(isDone).length}/{list.length}</em>}
              </header>
              <ul className="wk-list">
                {list.map((t) => <TaskRow key={t.id} t={t} done={isDone(t)} onToggle={() => toggle(t)} />)}
                {!list.length && <li className="wk-empty">—</li>}
              </ul>
            </section>
          );
        })}
      </div>

      {noDate.length > 0 && (
        <details className="panel wk-late">
          <summary><b>Sin fecha</b> <span className="muted">· {noDate.length}</span><span className="muted small" style={{ marginLeft: 'auto' }}>Abrir</span></summary>
          <ul className="wk-list">{noDate.map((t) => <TaskRow key={t.id} t={t} done={isDone(t)} onToggle={() => toggle(t)} />)}</ul>
        </details>
      )}
    </div>
  );
}

function TaskRow({ t, done, onToggle, showDate }: { t: PlanTask; done: boolean; onToggle: () => void; showDate?: boolean }) {
  return (
    <li className={`wk-task ${done ? 'is-done' : ''}`}>
      <input type="checkbox" className="check" checked={done} onChange={onToggle} aria-label={`Marcar ${t.title}`} />
      <div className="grow" style={{ minWidth: 0 }}>
        <Link href={t.href} className="wk-title">{t.title.replace(/^\[[^\]]+\]\s*/, '')}</Link>
        <div className="wk-meta">
          <i style={{ background: brandColor(t.brand) }} />
          <span>{t.where}</span>
          {t.responsable && <span>· {t.responsable}</span>}
          {showDate && t.due_date && <span>· {short(t.due_date)}</span>}
        </div>
      </div>
    </li>
  );
}

function CounterCard({ g }: { g: Goal }) {
  const [editing, setEditing] = useState(false);
  const pct = g.meta ? Math.min(100, ((g.actual ?? 0) / g.meta) * 100) : 0;
  return (
    <div className="wk-goal wk-counter" style={{ ['--c' as string]: brandColor(g.marca) }}>
      <span className="wk-brand">{g.marca}</span>
      <span className="wk-goal-title">{g.title.replace(/^[^:]+:\s*/, '')}</span>
      <div className="wk-num">
        <b>{(g.actual ?? 0).toLocaleString('es-AR')}</b>
        <span className="muted"> / {(g.meta ?? 0).toLocaleString('es-AR')} {g.unidad?.toLowerCase()}</span>
      </div>
      <div className="bar"><span style={{ width: `${pct}%`, background: 'var(--c)' }} /></div>
      {g.id && (editing ? (
        <form action={async (f) => { await updateGoalActual(f); setEditing(false); }} className="row" style={{ gap: 6, marginTop: 8 }}>
          <input type="hidden" name="id" value={g.id} />
          <input className="input" name="actual" inputMode="numeric" defaultValue={g.actual ?? ''} style={{ width: 110 }} autoFocus />
          <button className="btn sm">Guardar</button>
        </form>
      ) : (
        <button className="btn ghost sm" style={{ paddingLeft: 0, marginTop: 4 }} onClick={() => setEditing(true)}>Actualizar número</button>
      ))}
    </div>
  );
}
