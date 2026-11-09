'use client';

import { useState, useTransition } from 'react';
import { marked } from 'marked';
import type { VaultReport } from '@/lib/vault';
import { syncVaultNow } from '@/lib/vault-actions';

type Daily = { id: string; day: string; author: string; done: string | null; pending: string | null; blockers: string | null; next_steps: string | null; top_content: string | null; notes: string | null; published: number | null; planned: number | null; notion_id: string | null };

const d = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
const range = (a: string | null, b: string | null) => (a ? (b ? `${d(a)} – ${d(b)}` : d(a)) : '');
const md = (s: string) => marked.parse(s.replace(/</g, '&lt;'), { async: false }) as string;
const TIPOS = ['Todos', 'Weekly', 'Fulfillment', 'Cierre de semana', 'Mensual'];

export function VaultView({ reports, daily }: { reports: VaultReport[]; daily: Daily[] }) {
  const [tab, setTab] = useState<'semanales' | 'diarios'>('semanales');
  const [tipo, setTipo] = useState('Todos');
  const [open, setOpen] = useState<string | null>(reports[0]?.id ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const list = reports.filter((r) => tipo === 'Todos' || r.tipo === tipo);

  return (
    <>
      <div className="vault-bar">
        <div className="ct-tabs" role="tablist">
          <button role="tab" className={tab === 'semanales' ? 'on' : ''} aria-selected={tab === 'semanales'} onClick={() => setTab('semanales')}>Reportes ({reports.length})</button>
          <button role="tab" className={tab === 'diarios' ? 'on' : ''} aria-selected={tab === 'diarios'} onClick={() => setTab('diarios')}>Reportes del día ({daily.length})</button>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          {msg && <span className="small muted" role="status">{msg}</span>}
          <a className="btn ghost sm" href="https://www.notion.so/5a08bfd6bd0543e4b8777578774b17a7" target="_blank" rel="noopener noreferrer">Abrir en Notion</a>
          <button className="btn sm" disabled={pending} onClick={() => start(async () => { const r = await syncVaultNow(); setMsg(r.error ? `Error: ${r.error}` : `${r.count} reportes actualizados.`); })}>{pending ? 'Trayendo…' : 'Traer de Notion'}</button>
        </div>
      </div>

      {tab === 'semanales' ? (
        <>
          <div className="filters" style={{ margin: '12px 0' }}>
            {TIPOS.map((t) => <button key={t} className={`chip ${tipo === t ? 'on' : ''}`} onClick={() => setTipo(t)}>{t}</button>)}
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {list.map((r) => (
              <article key={r.id} className="panel vault-item">
                <button className="vault-head" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                  <div>
                    <b>{r.title}</b>
                    <span className="muted small">{[r.tipo, range(r.week_start, r.week_end), r.clientes.join(', ')].filter(Boolean).join(' · ')}</span>
                    {r.resumen && <span className="small vault-sum">{r.resumen}</span>}
                  </div>
                  <span className="muted">{open === r.id ? '−' : '+'}</span>
                </button>
                {open === r.id && (
                  <div className="vault-body">
                    {r.body_md ? <div className="prose" dangerouslySetInnerHTML={{ __html: md(r.body_md) }} /> : <p className="muted small">Sin contenido todavía. Tocá “Traer de Notion”.</p>}
                    <a className="btn ghost sm" href={`https://www.notion.so/${r.notion_id}`} target="_blank" rel="noopener noreferrer">Editar en Notion</a>
                  </div>
                )}
              </article>
            ))}
            {!list.length && <div className="panel empty">Todavía no hay reportes {tipo !== 'Todos' ? `de tipo ${tipo}` : ''} en la bóveda.</div>}
          </div>
        </>
      ) : (
        <div className="stack" style={{ gap: 10, marginTop: 12 }}>
          {daily.map((r) => (
            <article key={r.id} className="panel panel-pad vault-daily">
              <div className="row between">
                <b>{d(r.day)} · {r.author}</b>
                <span className="small muted">{r.planned ? `${r.published} de ${r.planned} publicadas` : ''}</span>
              </div>
              {r.done && <p><span className="muted small">Hecho:</span> {r.done}</p>}
              {r.top_content && <p><span className="muted small">Top contenido:</span> {r.top_content}</p>}
              {r.pending && <p><span className="muted small">Pendiente:</span> {r.pending}</p>}
              {r.next_steps && <p><span className="muted small">Próximos pasos:</span> {r.next_steps}</p>}
              {r.notes && <p><span className="muted small">Notas:</span> {r.notes}</p>}
              {r.blockers && <p className="late"><span className="small">Bloqueos:</span> {r.blockers}</p>}
            </article>
          ))}
          {!daily.length && <div className="panel empty">Todavía no hay reportes del día. Se cargan en Semáforo.</div>}
        </div>
      )}
    </>
  );
}
