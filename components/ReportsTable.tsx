import type { DailyReport } from '@/lib/eod';

const label = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
const isWeekday = (day: string) => { const d = new Date(`${day}T12:00:00Z`).getUTCDay(); return d !== 0 && d !== 6; };

function Cell({ text, tone }: { text: string | null; tone?: string }) {
  if (!text) return <td className="muted">—</td>;
  return <td className={tone}><div className="rp-clamp" title={text}>{text}</div></td>;
}

/** Tabla de reportes del día: un renglón por día hábil desde que arrancó el reporte, con los días sin reporte marcados. */
export function ReportsTable({ reports, today, start }: { reports: DailyReport[]; today: string; start: string }) {
  const byDay = new Map<string, DailyReport[]>();
  for (const r of reports) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);
  const days: string[] = [];
  for (let d = new Date(`${today}T12:00:00Z`); days.length < 30; d.setUTCDate(d.getUTCDate() - 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso < start) break;
    if (isWeekday(iso) || byDay.has(iso)) days.push(iso);
  }
  const sent = days.filter((d) => byDay.has(d)).length;
  const closed = days.filter((d) => d < today);
  const missing = closed.filter((d) => !byDay.has(d)).length;
  const pub = reports.filter((r) => days.includes(r.day)).reduce((a, r) => a + (Number(r.published) || 0), 0);
  const plan = reports.filter((r) => days.includes(r.day)).reduce((a, r) => a + (Number(r.planned) || 0), 0);

  return (
    <section id="reportes" className="panel panel-pad rp">
      <div className="eod-head">
        <div><b>Reportes del día</b><span className="muted small"> · últimos {days.length} días hábiles · también quedan en Notion</span></div>
        <div className="rp-stats small">
          <span><b>{sent}</b> enviados</span>
          <span className={missing ? 'late' : ''}><b>{missing}</b> sin reporte</span>
          {plan > 0 && <span><b>{Math.round((pub / plan) * 100)} %</b> publicado vs. planificado</span>}
        </div>
      </div>
      <div className="ct-table-wrap">
        <table className="rp-table">
          <thead>
            <tr><th>Día</th><th>Enviado</th><th>Publicadas</th><th>Qué se hizo</th><th>Pendiente</th><th>Bloqueos</th><th>Próximos pasos</th><th>Top contenido</th></tr>
          </thead>
          <tbody>
            {days.flatMap((d) => {
              const rs = byDay.get(d);
              if (!rs) return [(
                <tr key={d} className={d < today ? 'rp-missing' : 'rp-today'}>
                  <td className="nowrap"><a href={`/panel/semaforo?dia=${d}`}>{label(d)}</a></td>
                  <td colSpan={7}>{d < today ? 'Sin reporte' : 'Todavía no se envió el de hoy'}</td>
                </tr>
              )];
              return rs.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap"><a href={`/panel/semaforo?dia=${d}`}>{label(d)}</a></td>
                  <td className="nowrap">{r.author}<div className="muted small">{time(r.updated_at)}</div></td>
                  <td className="nowrap num">{r.planned ? `${r.published ?? 0} / ${r.planned}` : (r.published ?? '—')}</td>
                  <Cell text={r.done} />
                  <Cell text={r.pending} />
                  <Cell text={r.blockers} tone="late" />
                  <Cell text={r.next_steps} />
                  <Cell text={r.top_content} />
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted">Tocá el día para abrir y editar ese reporte. Pasá el mouse sobre un texto para leerlo completo.</p>
    </section>
  );
}
