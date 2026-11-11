import { getHealthBoard } from '@/lib/health';
import { HealthBoard } from '@/components/HealthBoard';
import { EodPanel } from '@/components/EodPanel';
import { getEod, EOD_START } from '@/lib/eod';
import { ReportsTable } from '@/components/ReportsTable';
import { todayAR } from '@/lib/health';
import { DEMO } from '@/lib/env';

export const metadata = { title: 'Semáforo' };
export const dynamic = 'force-dynamic';

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

export default async function Semaforo({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  if (DEMO) return <div className="panel panel-pad">No disponible en modo demo.</div>;
  const sp = await searchParams;
  const today = todayAR();
  const day = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) && sp.dia <= today ? sp.dia : today;
  const [{ rows, week }, eod] = await Promise.all([getHealthBoard(), getEod(day)]);
  const count = (c: string) => rows.filter((r) => r.color === c).length;
  const red = count('rojo');
  const redPct = rows.length ? red / rows.length : 0;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Semáforo</h1>
          <p>Cómo está cada cliente hoy: KPIs de la semana contra el plan, tareas y lo que va pasando. Semana del {fmt(week)}.</p>
        </div>
      </div>

      <section className="hl-summary">
        {(['rojo', 'amarillo', 'verde'] as const).map((c) => (
          <div key={c} className={`panel hl-sum ${c}`}>
            <span className={`hl-dot ${c} big`} />
            <div><b>{count(c)}</b><span className="muted small">{c === 'rojo' ? 'en rojo · se trabajan primero' : c === 'amarillo' ? 'en amarillo' : 'en verde'}</span></div>
          </div>
        ))}
        <div className={`panel hl-sum ${redPct > 0.08 ? 'rojo' : ''}`}>
          <div><b>{Math.round(redPct * 100)} %</b><span className="muted small">en rojo · regla: máximo 8 %</span></div>
        </div>
      </section>

      <EodPanel day={day} today={today} kpis={eod.kpis} report={eod.report} strikes={eod.strikes} owners={eod.owners} />

      <ReportsTable reports={eod.history} today={today} start={EOD_START} />

      <details className="panel panel-pad hl-help">
        <summary>Cómo se usa en la daily</summary>
        <ol>
          <li>Primero los clientes en <b>rojo</b>: cada uno llega con una propuesta concreta para levantarlo.</li>
          <li>Después los que están en <b>onboarding</b>: son prioridad porque ahí se gana o se pierde el cliente.</li>
          <li>Repasar las tareas de ayer: qué se terminó, qué no y por qué. Lo que no se hizo pasa a hoy.</li>
          <li>Actualizar los reales de los KPIs y anotar en la bitácora lo que pasó.</li>
        </ol>
        <p className="muted small">El color automático compara lo real contra el plan a la fecha: rojo hasta 80 %, amarillo hasta 98 %, verde desde 99 %. Si no hay KPIs, usa las tareas vencidas. Se puede fijar a mano.</p>
      </details>

      {rows.length ? <HealthBoard rows={rows} /> : <div className="panel empty">No hay clientes activos.</div>}
    </>
  );
}
