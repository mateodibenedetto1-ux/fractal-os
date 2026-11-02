'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toggleAction } from '@/lib/actions';
import type { JourneyView, Stage } from '@/lib/journey-view';

const fmt = (iso: string | null) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '');

function Lock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/**
 * Roadmap por etapas del Recorrido Fractal: una por módulo, conectada a las secciones del Segundo cerebro.
 * Las etapas futuras se desbloquean en su fecha (el equipo las ve igual).
 */
export function JourneyRoadmap({ view, base, staff }: { view: JourneyView; base: string; staff?: boolean }) {
  const [sel, setSel] = useState(view.current ?? view.stages[0].k);
  const [tasks, setTasks] = useState(() => Object.fromEntries(view.stages.flatMap((s) => s.tasks.map((t) => [t.id, t.done]))));
  const stage = view.stages.find((s) => s.k === sel)!;
  const current = view.stages.find((s) => s.k === view.current);
  const locked = stage.state === 'locked' && !staff;

  const toggle = (id: string) => {
    const next = !tasks[id];
    setTasks((m) => ({ ...m, [id]: next }));
    toggleAction(id, next).catch(() => setTasks((m) => ({ ...m, [id]: !next })));
  };

  const stagePct = (s: Stage) => {
    const items = [...s.sections.map((x) => x.pct >= 80), ...s.tasks.map((t) => tasks[t.id])];
    return items.length ? Math.round((items.filter(Boolean).length / items.length) * 100) : 0;
  };

  return (
    <div className="jr">
      <div className="jr-top panel panel-pad">
        <div className="row between wrap" style={{ gap: 10 }}>
          <div>
            <div className="muted small">Etapa actual</div>
            <div className="jr-now">{current ? `${current.n} · ${current.title}` : 'Recorrido completado'}</div>
          </div>
          <div className="jr-week">Semana {view.week} <span>de {view.totalWeeks}</span></div>
        </div>
        <div className="bar" style={{ marginTop: 12 }}><span style={{ width: `${view.pct}%` }} /></div>
        {view.docId && (
          <Link href={`${base}/biblioteca/${view.docId}`} className="small jr-doc">Leer tu estrategia completa →</Link>
        )}
      </div>

      <ol className="jr-steps" aria-label="Etapas del recorrido">
        {view.stages.map((s) => (
          <li key={s.k}>
            <button className={`jr-step ${s.state} ${s.k === sel ? 'on' : ''}`} onClick={() => setSel(s.k)} aria-current={s.k === sel ? 'step' : undefined}>
              <span className="jr-dot">{s.state === 'locked' ? <Lock /> : s.state === 'done' ? '✓' : s.n}</span>
              <span className="jr-label">{s.title}</span>
              <span className="jr-date">{fmt(s.start)}</span>
            </button>
          </li>
        ))}
      </ol>

      <section className={`panel panel-pad jr-stage ${stage.state}`} key={stage.k}>
        <div className="jr-kicker">
          Etapa {stage.n} · {fmt(stage.start)} – {fmt(stage.end)} · Lo guía {stage.lead}
          <span className={`tag ${stage.state === 'done' ? 'ok' : stage.state === 'now' ? 'brand' : ''}`}>
            {stage.state === 'done' ? 'Completada' : stage.state === 'now' ? 'En curso' : 'Bloqueada'}
          </span>
        </div>
        <h2>{stage.title}</h2>

        {locked ? (
          <div className="jr-locked">
            <Lock />
            <div>
              <b>Se desbloquea el {fmt(stage.start)}</b>
              <p className="muted small">{stage.about} Mientras tanto, enfocate en la etapa actual: cada paso prepara el siguiente.</p>
            </div>
          </div>
        ) : (
          <>
            {staff && stage.state === 'locked' && <p className="muted small" style={{ marginTop: -4 }}>El cliente la ve bloqueada hasta el {fmt(stage.start)}.</p>}
            <p className="jr-objective">{stage.objective ?? stage.about}</p>
            <div className="bar" style={{ maxWidth: 280, margin: '4px 0 22px' }}><span style={{ width: `${stagePct(stage)}%` }} /></div>

            <div className="jr-grid">
              <div>
                <h3>En tu Segundo cerebro</h3>
                <ul className="jr-list">
                  {stage.sections.map((s) => (
                    <li key={s.k}>
                      <Link href={`${base}/cerebro?s=${s.k}`} className="jr-sec">
                        <span>{s.n}. {s.title}</span>
                        <em className={s.pct >= 80 ? 'ok' : ''}>{s.pct}%</em>
                      </Link>
                    </li>
                  ))}
                </ul>
                {stage.hitos.length > 0 && (
                  <>
                    <h3>Hitos de esta etapa</h3>
                    <ul className="jr-list">
                      {stage.hitos.map((h) => (
                        <li key={h.id} className="jr-hito">
                          <span className="jr-flag" aria-hidden="true">◆</span>
                          <div>
                            <div>{h.title}</div>
                            <div className="muted small">{fmt(h.date)}{h.detail ? ` · ${h.detail}` : ''}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {view.classesUrl && <a href={view.classesUrl} target="_blank" rel="noreferrer" className="btn sm" style={{ marginTop: 6 }}>Ver las clases en Skool</a>}
              </div>

              <div>
                <h3>Tareas · {stage.tasks.filter((t) => tasks[t.id]).length}/{stage.tasks.length}</h3>
                <ul className="jr-list">
                  {stage.tasks.map((t) => (
                    <li key={t.id} className={`jr-task ${tasks[t.id] ? 'done' : ''}`}>
                      <input type="checkbox" className="check" checked={Boolean(tasks[t.id])} onChange={() => toggle(t.id)} aria-label={t.title} disabled={!staff && t.owner === 'fractal'} />
                      <div>
                        <div>{t.title}</div>
                        <div className="muted small">
                          {t.owner === 'fractal' ? 'Lo hace Fractal' : 'Lo hacés vos'}{t.due_date ? ` · ${fmt(t.due_date)}` : ''}{t.source === 'roadmap' ? ' · Personalizada' : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                  {!stage.tasks.length && <li className="muted small">Sin tareas en esta etapa.</li>}
                </ul>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
