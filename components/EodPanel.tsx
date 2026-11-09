'use client';

import { useState, useTransition } from 'react';
import type { DailyReport, EodKpi, Strike } from '@/lib/eod';
import { closeStrike, reopenStrike, saveEod } from '@/lib/eod-actions';

const short = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

function StrikeRow({ s }: { s: Strike }) {
  const [measure, setMeasure] = useState(s.measure ?? '');
  const [pending, start] = useTransition();
  return (
    <li className={`eod-strike ${s.status} ${pending ? 'busy' : ''}`}>
      <div className="eod-strike-main">
        <span className="eod-strike-tag">{s.kind === 'kpi' ? 'KPI' : 'Reporte'}</span>
        <span>{s.reason}</span>
        <span className="muted small">{short(s.day)} · {s.owner ?? 'Equipo'}</span>
      </div>
      {s.status === 'abierto' ? (
        <form className="eod-strike-close" onSubmit={(e) => { e.preventDefault(); start(() => closeStrike(s.id, measure)); }}>
          <input className="input sm" value={measure} onChange={(e) => setMeasure(e.target.value)} placeholder="Qué medida tomamos" aria-label="Medida" />
          <button className="btn sm">Cerrar</button>
        </form>
      ) : (
        <div className="small muted">
          Cerrado{s.closed_by ? ` por ${s.closed_by}` : ''}{s.measure ? `: ${s.measure}` : ''}{' '}
          <button className="linklike" onClick={() => start(() => reopenStrike(s.id))}>Reabrir</button>
        </div>
      )}
    </li>
  );
}

export function EodPanel({ day, today, kpis, report, history, strikes, owners }: {
  day: string; today: string; kpis: EodKpi[]; report: DailyReport | null; history: DailyReport[];
  strikes: Strike[]; owners: { owner: string; total: number; open: number }[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(kpis.map((k) => [k.id, String(k.today)])));
  const groups = [...new Set(kpis.map((k) => k.org))];
  const open = strikes.filter((s) => s.status === 'abierto');
  const closed = strikes.filter((s) => s.status === 'cerrado').slice(0, 10);
  const published = kpis.reduce((a, k) => a + (Number(vals[k.id]) || 0), 0);
  const planned = kpis.reduce((a, k) => a + k.dailyTarget, 0);

  return (
    <section className="eod-grid">
      <form className={`panel panel-pad eod ${pending ? 'busy' : ''}`} action={(f) => start(async () => { const r = await saveEod(f); setMsg(r.ok ? 'Reporte guardado. También quedó registrado en Notion.' : r.error ?? 'No se pudo guardar.'); })}>
        <div className="eod-head">
          <div>
            <b>Reporte del día</b>
            <span className="muted small"> · {day === today ? 'hoy' : short(day)}{report ? ` · enviado por ${report.author} a las ${time(report.updated_at)}` : ' · todavía no se envió'}</span>
          </div>
          <div className="eod-days" role="group" aria-label="Día del reporte">
            <a className={day === today ? 'on' : ''} href="/panel/semaforo">Hoy</a>
            {[1, 2].map((n) => {
              const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n);
              const iso = d.toISOString().slice(0, 10);
              return <a key={iso} className={day === iso ? 'on' : ''} href={`/panel/semaforo?dia=${iso}`}>{n === 1 ? 'Ayer' : short(iso)}</a>;
            })}
          </div>
        </div>
        <input type="hidden" name="day" value={day} />

        {kpis.length > 0 ? (
          <div className="eod-kpis">
            {groups.map((g) => (
              <div key={g}>
                <div className="hl-sub"><span>{g}</span><span className="muted small">publicado / meta del día</span></div>
                {kpis.filter((k) => k.org === g).map((k) => {
                  const n = Number(vals[k.id]) || 0;
                  const ok = n >= k.dailyTarget;
                  return (
                    <label key={k.id} className="eod-kpi">
                      <span>{k.name}</span>
                      <span className="eod-kpi-in">
                        <input className="input sm" type="number" min={0} step="any" name={`kpi_${k.id}`} value={vals[k.id]} onChange={(e) => setVals({ ...vals, [k.id]: e.target.value })} />
                        <span className={`small ${ok ? 'ok' : 'late'}`}>/ {k.dailyTarget}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
            <p className="small muted">Total del día: <b>{published}</b> de {Math.round(planned * 10) / 10}. Si un KPI queda por debajo de la meta del día dos días seguidos, se genera un strike.</p>
          </div>
        ) : <p className="muted small">No hay KPIs diarios cargados esta semana.</p>}

        <div className="eod-texts">
          <label><span className="small">Qué se hizo hoy</span><textarea className="input" name="done" rows={3} defaultValue={report?.done ?? ''} placeholder="Publicaciones, entregas, avances por cliente" /></label>
          <label><span className="small">Qué quedó pendiente y por qué</span><textarea className="input" name="pending" rows={2} defaultValue={report?.pending ?? ''} /></label>
          <label><span className="small">Bloqueos</span><textarea className="input" name="blockers" rows={2} defaultValue={report?.blockers ?? ''} placeholder="Qué o quién lo frena" /></label>
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <button className="btn primary" disabled={pending}>{report ? 'Actualizar reporte' : 'Enviar reporte del día'}</button>
          {msg && <span className="small" role="status">{msg}</span>}
        </div>

        {history.length > 0 && (
          <details className="eod-history">
            <summary className="small">Reportes anteriores</summary>
            <ul>
              {history.filter((h) => h.day !== day).slice(0, 10).map((h) => (
                <li key={h.id}>
                  <b>{short(h.day)}</b> · {h.author}{h.planned ? ` · ${h.published} de ${h.planned}` : ''}
                  {h.done && <div className="small">{h.done}</div>}
                  {h.blockers && <div className="small late">Bloqueos: {h.blockers}</div>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </form>

      <aside className="panel panel-pad eod-strikes">
        <div className="eod-head"><b>Strikes</b><span className="muted small">{open.length} abiertos</span></div>
        <div className="eod-owners">
          {owners.length ? owners.map((o) => (
            <div key={o.owner} className={o.total >= 3 ? 'alert' : ''}><b>{o.total}</b><span className="small muted">{o.owner}{o.open ? ` · ${o.open} abiertos` : ''}</span></div>
          )) : <span className="small muted">Sin strikes. 💪</span>}
        </div>
        <ul className="eod-strike-list">
          {open.map((s) => <StrikeRow key={s.id} s={s} />)}
        </ul>
        {closed.length > 0 && (
          <details>
            <summary className="small muted">Cerrados</summary>
            <ul className="eod-strike-list">{closed.map((s) => <StrikeRow key={s.id} s={s} />)}</ul>
          </details>
        )}
        <details className="small muted eod-rules">
          <summary>Cómo funcionan</summary>
          <p>Se genera un strike cuando un KPI diario queda por debajo de la meta del día dos días seguidos, o cuando faltan dos reportes del día seguidos (días hábiles). Se acumulan por persona. Cada strike se cierra con la medida que tomamos según la situación del cliente. Con 3 o más, se revisa en la daily.</p>
        </details>
      </aside>
    </section>
  );
}
