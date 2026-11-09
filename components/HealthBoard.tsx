'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { HealthRow, Light } from '@/lib/health';
import { addHealthNote, addKpi, copyLastWeekKpis, deleteKpi, setHealth, setImportance, setKpiActual } from '@/lib/health-actions';

const LABEL: Record<Light, string> = { verde: 'Verde', amarillo: 'Amarillo', rojo: 'Rojo' };
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const n = (x: number) => (Math.round(x * 10) / 10).toLocaleString('es-AR');
const when = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) + ' ' + new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });

function Dot({ c, big }: { c: Light | null; big?: boolean }) {
  return <span className={`hl-dot ${c ?? 'none'} ${big ? 'big' : ''}`} aria-label={c ? LABEL[c] : 'Sin dato'} />;
}

function KpiRow({ k }: { k: HealthRow['kpis'][number] }) {
  const [val, setVal] = useState(String(k.actual));
  const [pending, start] = useTransition();
  const save = (x: number) => { setVal(String(x)); start(() => setKpiActual(k.id, x)); };
  const c: Light | null = k.pct == null ? null : k.pct <= 0.8 ? 'rojo' : k.pct < 0.99 ? 'amarillo' : 'verde';
  return (
    <tr className={pending ? 'busy' : ''}>
      <td><Dot c={c} /> {k.name}</td>
      <td className="num muted">{n(k.plan)}<span className="small"> / {n(k.target)}</span></td>
      <td className="num">
        <span className="hl-step">
          <button type="button" onClick={() => save(Math.max(0, Number(val) - 1))} aria-label="Restar uno">−</button>
          <input value={val} inputMode="decimal" onChange={(e) => setVal(e.target.value)} onBlur={() => Number(val) !== k.actual && save(Number(val) || 0)} aria-label={`Real de ${k.name}`} />
          <button type="button" onClick={() => save(Number(val) + 1)} aria-label="Sumar uno">+</button>
        </span>
      </td>
      <td className={`num hl-pct ${c ?? ''}`}>{k.pct == null ? '—' : `${Math.round(k.pct * 100)} %`}</td>
      <td><button type="button" className="hl-x" onClick={() => confirm(`¿Borrar "${k.name}"?`) && start(() => deleteKpi(k.id))} aria-label="Borrar KPI">×</button></td>
    </tr>
  );
}

function ClientCard({ r }: { r: HealthRow }) {
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const todayDow = ((new Date().getDay() + 6) % 7) + 1;
  const todaySteps = r.org.workflow.filter((s) => s.dow === todayDow);
  return (
    <article className={`panel hl-card ${r.color ?? 'none'} ${pending ? 'busy' : ''}`}>
      <header className="hl-head">
        <Dot c={r.color} big />
        <div className="hl-title">
          <Link href={`/panel/clientes/${r.org.slug}`}><b>{r.org.name}</b></Link>
          <span className="muted small">
            {r.stage.label}{r.org.vertical ? ` · ${r.org.vertical}` : ''} · {r.manual?.color ? `manual (${r.manual.updated_by ?? 'equipo'})` : 'automático'}
          </span>
        </div>
        <div className="hl-actions">
          <select className="select sm" value={r.manual?.importance ?? ''} onChange={(e) => start(() => setImportance(r.org.id, e.target.value || null))} aria-label="Importancia">
            <option value="">Importancia</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
          </select>
          <div className="hl-lights" role="group" aria-label="Color del semáforo">
            {(['verde', 'amarillo', 'rojo'] as Light[]).map((c) => (
              <button key={c} type="button" className={`${c} ${r.manual?.color === c ? 'on' : ''}`} title={LABEL[c]} aria-pressed={r.manual?.color === c}
                onClick={() => start(() => setHealth(r.org.id, r.manual?.color === c ? null : c))}><span className={`hl-dot ${c}`} /></button>
            ))}
          </div>
        </div>
      </header>

      <p className="small muted hl-why">
        Automático: <Dot c={r.auto} /> {r.autoWhy}{r.manual?.color && r.manual.color !== r.auto ? ' El color manual pisa al automático: tocá el mismo color para volver.' : ''}
      </p>

      <div className="hl-grid">
        <section>
          <div className="hl-sub"><span>KPIs de la semana</span><span className="muted small">plan a la fecha / meta</span></div>
          {r.kpis.length ? (
            <table className="hl-kpis"><tbody>{r.kpis.map((k) => <KpiRow key={k.id} k={k} />)}</tbody></table>
          ) : <p className="muted small">Sin KPIs esta semana.</p>}
          {addOpen ? (
            <form action={(f) => start(async () => { await addKpi(f); setAddOpen(false); })} className="hl-add">
              <input type="hidden" name="org_id" value={r.org.id} />
              <input className="input sm" name="name" placeholder="Ej. TikTok Marcela" required />
              <input className="input sm" name="target" type="number" min={0} step="any" placeholder="Meta semana" required />
              <label className="small"><input type="checkbox" name="daily" defaultChecked /> Se reparte por día</label>
              <button className="btn sm primary">Agregar</button>
            </form>
          ) : (
            <div className="hl-links">
              <button type="button" className="btn ghost sm" onClick={() => setAddOpen(true)}>+ KPI</button>
              <button type="button" className="btn ghost sm" onClick={() => start(() => copyLastWeekKpis(r.org.id))}>Copiar de la semana pasada</button>
            </div>
          )}
        </section>

        <section>
          <div className="hl-sub"><span>Tareas</span><span className="muted small">{r.tasks.weekDone}/{r.tasks.weekTotal} de la semana{r.tasks.overdue ? ` · ${r.tasks.overdue} vencidas` : ''}{r.tasks.oldOverdue ? ` · ${r.tasks.oldOverdue} viejas sin cerrar` : ''}</span></div>
          <ul className="hl-tasks">
            {r.tasks.next.map((t) => (
              <li key={t.id} className={t.due_date && t.due_date < new Date().toISOString().slice(0, 10) ? 'late' : ''}>
                <span>{t.title}</span>
                <span className="muted small">{t.due_date ? day(t.due_date) : 'sin fecha'}{t.responsable ? ` · ${t.responsable}` : ''}</span>
              </li>
            ))}
            {!r.tasks.next.length && <li className="muted small">Sin tareas abiertas.</li>}
          </ul>
          {r.org.workflow.length > 0 && (
            <p className="small hl-today">
              <b>Hoy en el workflow:</b> {todaySteps.length ? todaySteps.map((s) => s.title).join(' · ') : 'nada fijo'}
              <span className="muted"> · semana: {r.org.workflow.map((s) => `${DAYS[s.dow - 1]} ${s.title.toLowerCase()}`).join(', ')}</span>
            </p>
          )}
        </section>

        <section>
          <div className="hl-sub"><span>Bitácora</span></div>
          <form action={(f) => start(async () => { await addHealthNote(f); (document.getElementById(`note-${r.org.id}`) as HTMLInputElement).value = ''; })} className="hl-note">
            <input type="hidden" name="org_id" value={r.org.id} />
            <input id={`note-${r.org.id}`} className="input sm" name="note" placeholder="Qué pasó hoy con este cliente" />
            <button className="btn sm">Anotar</button>
          </form>
          <ul className="hl-log">
            {r.log.map((l) => <li key={l.id}><Dot c={l.color} /> <span>{l.note}</span> <span className="muted small">{when(l.created_at)}{l.author ? ` · ${l.author}` : ''}</span></li>)}
            {!r.log.length && <li className="muted small">Todavía no hay registros.</li>}
          </ul>
        </section>
      </div>
    </article>
  );
}

export function HealthBoard({ rows }: { rows: HealthRow[] }) {
  return <div className="stack" style={{ gap: 14 }}>{rows.map((r) => <ClientCard key={r.org.id} r={r} />)}</div>;
}
