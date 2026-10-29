import { fmtDate } from '@/lib/format';
import type { RoadmapItem, RoadmapView } from '@/lib/roadmap';

const short = (iso: string | null) => (iso ? fmtDate(iso, { day: 'numeric', month: 'short' }) : '');

/** Barra de avance del programa según el tiempo transcurrido. */
export function RoadmapProgress({ view, compact }: { view: RoadmapView; compact?: boolean }) {
  if (!view.start || !view.totalWeeks) return null;
  return (
    <div className={compact ? '' : 'panel panel-pad'}>
      <div className="row between wrap" style={{ marginBottom: 12, gap: 8 }}>
        <div>
          <div className="muted small">Dónde estamos</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>{view.current ? view.current.title : view.next ? `Próximo: ${view.next.title}` : 'Programa completado'}</div>
        </div>
        <span className="serif" style={{ fontSize: 26 }}>
          Semana {view.week} <span className="muted" style={{ fontSize: 15 }}>de {view.totalWeeks}</span>
        </span>
      </div>
      <div className="timebar" role="img" aria-label={`Avance del programa: ${Math.round(view.pct)}%`}>
        <span style={{ width: `${view.pct}%` }} />
        {view.phases.map((p) => {
          const s = new Date(view.start! + 'T12:00:00').getTime();
          const e = new Date(view.end! + 'T12:00:00').getTime();
          const at = ((new Date(p.due_date! + 'T12:00:00').getTime() - s) / Math.max(1, e - s)) * 100;
          return at > 0 && at < 100 ? <i key={p.id} style={{ left: `${at}%` }} /> : null;
        })}
      </div>
      <div className="row between muted small" style={{ marginTop: 8 }}>
        <span>Inicio · {short(view.start)}</span>
        {view.next && <span>Siguiente: {view.next.title} · {short(view.next.due_date)}</span>}
      </div>
    </div>
  );
}

/** Fases con sus rangos y los hitos de cada una, con estado calculado por fecha. */
export function Roadmap({ view, controls }: { view: RoadmapView; controls?: (m: RoadmapItem) => React.ReactNode }) {
  if (!view.items.length) return <div className="panel empty">El roadmap todavía no tiene fases ni hitos.</div>;

  // Agrupa cada hito dentro de la fase cuyo rango lo contiene
  const groups: { phase: RoadmapItem | null; hitos: RoadmapItem[] }[] = [];
  const loose: RoadmapItem[] = [];
  for (const p of view.phases) groups.push({ phase: p, hitos: [] });
  for (const h of view.items.filter((i) => i.kindResolved === 'hito')) {
    const g = groups.find((x) => x.phase && h.due_date && h.due_date >= x.phase.due_date! && (!x.phase.end || h.due_date <= x.phase.end));
    if (g) g.hitos.push(h);
    else loose.push(h);
  }
  if (loose.length) groups.unshift({ phase: null, hitos: loose });

  return (
    <div className="stack" style={{ gap: 14 }}>
      <RoadmapProgress view={view} />
      <ol className="roadmap">
        {groups.map((g, i) => (
          <li key={g.phase?.id ?? `loose-${i}`} className={`rm-phase is-${g.phase?.derived ?? 'pendiente'}`}>
            {g.phase && (
              <div className="rm-head">
                <span className="rm-dot" aria-hidden="true" />
                <div className="grow">
                  <div className="row wrap" style={{ gap: 8 }}>
                    <b>{g.phase.title}</b>
                    {g.phase.derived === 'en_curso' && <span className="tag brand">Ahora</span>}
                    {g.phase.derived === 'listo' && <span className="tag ok">Completada</span>}
                    {g.phase.auto_status === false && <span className="tag">Fijado a mano</span>}
                  </div>
                  <div className="muted small">
                    {short(g.phase.due_date)}
                    {g.phase.end ? ` – ${short(g.phase.end)}` : ''}
                    {g.phase.detail ? ` · ${g.phase.detail}` : ''}
                  </div>
                </div>
                {controls?.(g.phase)}
              </div>
            )}
            {g.hitos.length > 0 && (
              <ul className="rm-hitos">
                {g.hitos.map((h) => (
                  <li key={h.id} className={`is-${h.derived}`}>
                    <span className="rm-diamond" aria-hidden="true" />
                    <span className="grow">{h.title}</span>
                    {h.soon && <span className="tag warn">Esta semana</span>}
                    <span className="muted small">{short(h.due_date)}</span>
                    {controls?.(h)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
