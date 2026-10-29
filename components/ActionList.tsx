'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { deleteAction, setActionResponsable, toggleAction } from '@/lib/actions';
import { fmtDate, PRIORITY_LABEL } from '@/lib/format';
import type { ActionItem, Call, Responsable } from '@/lib/types';
import { Icon } from './Icon';

type CallRef = Pick<Call, 'id' | 'title' | 'held_at'>;

interface Props {
  items: ActionItem[];
  calls: CallRef[];
  staff?: boolean;
  demo?: boolean;
  /** Solo pendientes (portal) o todo */
  initialFilter?: 'pendientes' | 'todos';
  responsables?: Responsable[];
  /** Nombre del cliente por id (tracker interno de Fractal) */
  clientNames?: Record<string, string>;
  progressLabel?: string;
  flatLabel?: string;
}

export function ActionList({ items, calls, staff, demo, initialFilter = 'pendientes', responsables = [], clientNames, progressLabel, flatLabel }: Props) {
  const [local, setLocal] = useState(items);
  const [optimistic, setOptimistic] = useOptimistic(local, (state, p: { id: string; done: boolean }) =>
    state.map((a) => (a.id === p.id ? { ...a, done: p.done } : a)),
  );
  const [filter, setFilter] = useState(initialFilter);
  const [who, setWho] = useState('Todos');
  const [, start] = useTransition();

  const toggle = (id: string, done: boolean) => {
    start(async () => {
      setOptimistic({ id, done });
      if (!demo) await toggleAction(id, done);
      setLocal((s) => s.map((a) => (a.id === id ? { ...a, done } : a)));
    });
  };

  const assign = (id: string, responsable: string | null) => {
    const side = responsables.find((r) => r.name === responsable)?.side;
    setLocal((s) => s.map((a) => (a.id === id ? { ...a, responsable, ...(side ? { owner: side } : {}) } : a)));
    start(async () => {
      if (!demo) await setActionResponsable(id, responsable);
    });
  };

  const remove = (id: string) => {
    if (!confirm('¿Borrar este accionable?')) return;
    start(async () => {
      await deleteAction(id);
      setLocal((s) => s.filter((a) => a.id !== id && a.parent_id !== id));
    });
  };

  const tops = optimistic.filter((a) => !a.parent_id);
  const subs = (id: string) => optimistic.filter((a) => a.parent_id === id);
  const done = tops.filter((a) => a.done).length;
  const visible = tops.filter((a) => (filter === 'todos' || !a.done || subs(a.id).some((s) => !s.done)) && (who === 'Todos' || (a.responsable ?? 'Sin asignar') === who));

  // Agrupar por llamada, de la más reciente a la más antigua
  const byCall = new Map<string, ActionItem[]>();
  for (const a of visible) {
    const k = a.call_id ?? 'none';
    byCall.set(k, [...(byCall.get(k) ?? []), a]);
  }
  const callOrder = [...calls].sort((a, b) => b.held_at.localeCompare(a.held_at));
  const groups = [
    ...callOrder.filter((c) => byCall.has(c.id)).map((c, i) => ({
      key: c.id,
      label: `De tu llamada del ${fmtDate(c.held_at)}${i === 0 ? ' · la más reciente' : ''}`,
      staffLabel: `${c.title} · ${fmtDate(c.held_at)}`,
      items: byCall.get(c.id)!,
    })),
    ...(byCall.has('none') ? [{ key: 'none', label: flatLabel ?? 'Otros accionables', staffLabel: flatLabel ?? 'Sin llamada asociada', items: byCall.get('none')! }] : []),
  ];

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="panel panel-pad">
        <div className="row between" style={{ marginBottom: 12 }}>
          <span className="muted small">{progressLabel ?? 'Tu avance en todas las llamadas'}</span>
          <span className="serif" style={{ fontSize: 26 }}>
            {done} de {tops.length}
          </span>
        </div>
        <div className="bar">
          <span style={{ width: `${tops.length ? (done / tops.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="row between">
        <div className="row" role="group" aria-label="Filtro">
          {(['pendientes', 'todos'] as const).map((f) => (
            <button key={f} className={`btn sm ${filter === f ? 'primary' : ''}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>
              {f === 'pendientes' ? `Pendientes · ${tops.length - done}` : 'Todos'}
            </button>
          ))}
        </div>
        {responsables.length > 0 && (
          <select className="select" value={who} onChange={(e) => setWho(e.target.value)} style={{ width: 180 }} aria-label="Filtrar por responsable">
            <option>Todos</option>
            {responsables.map((r) => <option key={r.name}>{r.name}</option>)}
            <option>Sin asignar</option>
          </select>
        )}
      </div>

      <div className="panel">
        {groups.length === 0 && (
          <p className="empty">
            {filter === 'pendientes' ? 'No te queda nada pendiente. Todo lo de tus llamadas está completado.' : 'Todavía no hay accionables. Aparecen acá después de cada llamada.'}
          </p>
        )}
        {groups.map((g) => (
          <div key={g.key}>
            <div className="group-label">{staff ? g.staffLabel : g.label}</div>
            <ul className="list">
              {g.items.map((a) => (
                <li key={a.id}>
                  <Row a={a} onToggle={toggle} onDelete={staff ? remove : undefined} responsables={responsables} onAssign={staff ? assign : undefined} client={a.client_org_id ? clientNames?.[a.client_org_id] : undefined} />
                  {subs(a.id).map((s) => (
                    <Row key={s.id} a={s} sub onToggle={toggle} onDelete={staff ? remove : undefined} />
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ a, sub, onToggle, onDelete, onAssign, responsables = [], client }: {
  a: ActionItem; sub?: boolean; onToggle: (id: string, d: boolean) => void; onDelete?: (id: string) => void;
  onAssign?: (id: string, r: string | null) => void; responsables?: Responsable[]; client?: string;
}) {
  const id = `a-${a.id}`;
  return (
    <div className={`action ${sub ? 'sub' : ''} ${a.done ? 'is-done' : ''}`}>
      <input id={id} type="checkbox" className="check" checked={a.done} onChange={(e) => onToggle(a.id, e.target.checked)} />
      <div className="grow">
        <label htmlFor={id} className="title" style={{ cursor: 'pointer' }}>
          {a.title}
        </label>
        {a.why && !sub && <p className="why">{a.why}</p>}
        {!sub && (a.area || a.priority || a.owner === 'fractal' || a.due_date || a.responsable || onAssign) && (
          <div className="row wrap" style={{ gap: 6, marginTop: 7 }}>
            {client && <span className="tag">{client}</span>}
            {onAssign && responsables.length > 0 ? (
              <select
                className={`tag-select ${a.owner === 'fractal' ? 'brand' : ''}`}
                value={a.responsable ?? ''}
                onChange={(e) => onAssign(a.id, e.target.value || null)}
                aria-label="Responsable"
              >
                <option value="">Sin responsable</option>
                {responsables.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
            ) : a.responsable ? (
              <span className={`tag ${a.owner === 'fractal' ? 'brand' : ''}`}>{a.owner === 'fractal' && a.responsable === 'Fractal' ? 'Lo hace Fractal' : `A cargo de ${a.responsable}`}</span>
            ) : (
              a.owner === 'fractal' && <span className="tag brand">Lo hace Fractal</span>
            )}
            {a.priority && <span className={`tag ${a.priority === 'critica' || a.priority === 'alta' ? 'warn' : ''}`}>{PRIORITY_LABEL[a.priority]}</span>}
            {a.area && <span className="tag">{a.area}</span>}
            {a.due_date && <span className="tag">Para el {fmtDate(a.due_date, { day: 'numeric', month: 'short' })}</span>}
          </div>
        )}
      </div>
      {onDelete && (
        <button className="btn ghost sm" onClick={() => onDelete(a.id)} aria-label="Borrar accionable">
          <Icon name="trash" size={14} />
        </button>
      )}
    </div>
  );
}
