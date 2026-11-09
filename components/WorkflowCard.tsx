'use client';

import { useState, useTransition } from 'react';
import type { WorkflowStep } from '@/lib/health';
import { createWeekFromWorkflow, saveWorkflow } from '@/lib/health-actions';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Workflow semanal del cliente: lo ve el cliente y el equipo; el equipo lo edita y genera los accionables de la semana. */
export function WorkflowCard({ orgId, steps, staff, clientName }: { orgId: string; steps: WorkflowStep[]; staff: boolean; clientName: string }) {
  const [edit, setEdit] = useState(false);
  const [list, setList] = useState<WorkflowStep[]>(steps);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = ((new Date().getDay() + 6) % 7) + 1;

  if (!steps.length && !staff) return null;

  const set = (i: number, patch: Partial<WorkflowStep>) => setList(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <section className={`panel panel-pad wf ${pending ? 'busy' : ''}`}>
      <div className="wf-head">
        <div>
          <b>Workflow de la semana</b>
          <span className="muted small"> · cómo trabajamos juntos cada semana</span>
        </div>
        {staff && !edit && (
          <div className="wf-actions">
            {steps.length > 0 && (
              <button className="btn sm" disabled={pending} onClick={() => start(async () => { const r = await createWeekFromWorkflow(orgId); setMsg(r.created ? `Se crearon ${r.created} accionables de esta semana.` : 'Los accionables de esta semana ya estaban creados.'); })}>
                Crear accionables de esta semana
              </button>
            )}
            <button className="btn ghost sm" onClick={() => { setList(steps.length ? steps : [{ dow: 1, title: '', side: 'fractal' }]); setEdit(true); }}>{steps.length ? 'Editar' : 'Armar workflow'}</button>
          </div>
        )}
      </div>
      {msg && <p className="small" role="status" style={{ color: 'var(--ok)' }}>{msg}</p>}

      {edit ? (
        <div className="stack" style={{ gap: 8 }}>
          {list.map((s, i) => (
            <div key={i} className="wf-edit">
              <select className="select sm" value={s.dow} onChange={(e) => set(i, { dow: Number(e.target.value) })} aria-label="Día">
                {DAYS.map((d, j) => <option key={d} value={j + 1}>{d}</option>)}
              </select>
              <input className="input sm" value={s.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Qué pasa ese día" aria-label="Paso" />
              <select className="select sm" value={s.side} onChange={(e) => set(i, { side: e.target.value as WorkflowStep['side'] })} aria-label="Quién">
                <option value="fractal">Fractal</option><option value="cliente">{clientName}</option>
              </select>
              <input className="input sm" value={s.responsable ?? ''} onChange={(e) => set(i, { responsable: e.target.value })} placeholder="Responsable" aria-label="Responsable" />
              <button className="hl-x" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label="Quitar paso">×</button>
            </div>
          ))}
          <div className="wf-actions">
            <button className="btn ghost sm" onClick={() => setList([...list, { dow: list.at(-1)?.dow ?? 1, title: '', side: 'fractal' }])}>+ Paso</button>
            <button className="btn primary sm" disabled={pending} onClick={() => start(async () => { await saveWorkflow(orgId, list); setEdit(false); })}>Guardar</button>
            <button className="btn ghost sm" onClick={() => setEdit(false)}>Cancelar</button>
          </div>
        </div>
      ) : steps.length ? (
        <ol className="wf-days">
          {DAYS.map((d, j) => {
            const mine = steps.filter((s) => s.dow === j + 1);
            if (!mine.length) return null;
            return (
              <li key={d} className={today === j + 1 ? 'today' : ''}>
                <span className="wf-day">{d}{today === j + 1 ? ' · hoy' : ''}</span>
                {mine.map((s, k) => (
                  <span key={k} className="wf-step">
                    <span>{s.title}</span>
                    <em className={s.side}>{s.side === 'fractal' ? `Fractal${s.responsable ? ` · ${s.responsable}` : ''}` : `${clientName}${s.responsable ? ` · ${s.responsable}` : ''}`}</em>
                  </span>
                ))}
              </li>
            );
          })}
        </ol>
      ) : <p className="muted small">Todavía no hay workflow. Armalo para que el cliente vea qué pasa cada día de la semana.</p>}
    </section>
  );
}
