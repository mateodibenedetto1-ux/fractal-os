'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import { setLabEstado } from '@/lib/actions';
import { ESTADOS, TIPOS, TIPO_HELP, TIPO_PLURAL } from '@/lib/lab-content';
import type { LabEntry } from '@/lib/types';

const TIPO_TONE: Record<string, string> = {
  Falla: 'var(--brand)', Aprendizaje: 'var(--ok)', Feedback: 'var(--focus)', Experimento: 'var(--warn)',
  Hipótesis: '#8a6bb8', Decisión: 'var(--ink-2)', SOP: 'var(--muted)',
};

const fmt = (iso: string | null) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '—');

export function AtlasTable({ entries, initialTipo }: { entries: LabEntry[]; initialTipo?: string }) {
  const [tipo, setTipo] = useState<string>(initialTipo ?? 'Todos');
  const [area, setArea] = useState('Todas');
  const [estado, setEstado] = useState('Todos');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [rows, setRows] = useState(entries);
  const [, start] = useTransition();

  const areas = useMemo(() => Array.from(new Set(entries.map((e) => e.area).filter(Boolean))) as string[], [entries]);
  const counts = useMemo(() => Object.fromEntries(TIPOS.map((t) => [t, rows.filter((e) => e.tipo === t).length])), [rows]);

  const visible = rows.filter((e) =>
    (tipo === 'Todos' || e.tipo === tipo) &&
    (area === 'Todas' || e.area === area) &&
    (estado === 'Todos' || e.estado === estado) &&
    (!q || `${e.title} ${e.notas ?? ''} ${e.cliente ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  );

  const changeEstado = (id: string, value: string) => {
    setRows((r) => r.map((e) => (e.id === id ? { ...e, estado: value } : e)));
    start(() => setLabEstado(id, value));
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="chips" role="group" aria-label="Tipo de registro">
        <button className={`chip ${tipo === 'Todos' ? 'on' : ''}`} onClick={() => setTipo('Todos')}>Todos <span>{rows.length}</span></button>
        {TIPOS.filter((t) => counts[t]).map((t) => (
          <button key={t} className={`chip ${tipo === t ? 'on' : ''}`} onClick={() => setTipo(t)} title={TIPO_HELP[t]}>
            <i style={{ background: TIPO_TONE[t] }} />{TIPO_PLURAL[t]} <span>{counts[t]}</span>
          </button>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 10 }}>
        <input className="input" type="search" placeholder="Buscar en el Atlas" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} aria-label="Buscar" />
        <select className="select" value={area} onChange={(e) => setArea(e.target.value)} style={{ width: 170 }} aria-label="Área">
          <option>Todas</option>{areas.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select className="select" value={estado} onChange={(e) => setEstado(e.target.value)} style={{ width: 170 }} aria-label="Estado">
          <option>Todos</option>{ESTADOS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="panel atlas-wrap">
        <table className="atlas">
          <thead>
            <tr><th>Registro</th><th>Tipo</th><th>Área</th><th>Estado</th><th>Prioridad</th><th>Cliente</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <Fragment key={e.id}>
                <tr className={open === e.id ? 'is-open' : ''} onClick={() => setOpen(open === e.id ? null : e.id)} tabIndex={0}
                  onKeyDown={(k) => (k.key === 'Enter' || k.key === ' ') && setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                  <td className="atlas-title">{e.title}</td>
                  <td><span className="type-dot" style={{ background: TIPO_TONE[e.tipo ?? ''] ?? 'var(--line)' }} />{e.tipo ?? '—'}</td>
                  <td>{e.area ?? '—'}</td>
                  <td><span className={`tag ${e.estado === 'Validado' ? 'ok' : e.estado === 'En prueba' ? 'warn' : ''}`}>{e.estado}</span></td>
                  <td className={e.prioridad === 'Crítica' ? 'crit' : ''}>{e.prioridad ?? '—'}</td>
                  <td>{e.cliente ?? '—'}</td>
                  <td className="muted">{fmt(e.fecha)}</td>
                </tr>
                {open === e.id && (
                  <tr className="atlas-detail">
                    <td colSpan={7}>
                      <div className="stack" style={{ gap: 12 }}>
                        {e.notas && <p style={{ maxWidth: '75ch', lineHeight: 1.6 }}>{e.notas}</p>}
                        <div className="row wrap" style={{ gap: 8 }}>
                          <span className="muted small">Mover a</span>
                          {ESTADOS.filter((s) => s !== e.estado).map((s) => (
                            <button key={s} className="btn sm" onClick={() => changeEstado(e.id, s)}>{s}</button>
                          ))}
                          {e.fuente && <a className="btn ghost sm" href={e.fuente} target="_blank" rel="noopener noreferrer">Ver fuente</a>}
                          {e.notion_id && <a className="btn ghost sm" href={`https://www.notion.so/${e.notion_id}`} target="_blank" rel="noopener noreferrer">Abrir en Notion</a>}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!visible.length && <tr><td colSpan={7} className="empty">No hay registros con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
