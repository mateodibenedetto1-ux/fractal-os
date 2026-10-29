import { getMilestones, getOrgBySlug } from '@/lib/data';
import { addMilestone, deleteMilestone, resetMilestoneAuto, setMilestoneStatus } from '@/lib/actions';
import { computeRoadmap } from '@/lib/roadmap';
import { Roadmap } from '@/components/Roadmap';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const view = computeRoadmap(await getMilestones(org.id), org.start_date);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <p className="muted small" style={{ maxWidth: '70ch' }}>
        El estado de cada fase se calcula con la fecha de hoy: lo que ya pasó queda completado y la fase vigente aparece como &ldquo;Ahora&rdquo;.
        Si algo se atrasó o se adelantó, fijalo a mano desde acá.
      </p>
      <Roadmap
        view={view}
        controls={(m) => (
          <details className="rm-menu">
            <summary className="btn ghost sm" aria-label={`Opciones de ${m.title}`}>···</summary>
            <div className="rm-menu-pop panel">
              {(['pendiente', 'en_curso', 'listo'] as const).map((s) => (
                <form key={s} action={setMilestoneStatus.bind(null, m.id, s)}>
                  <button className="btn ghost sm">{s === 'pendiente' ? 'Fijar pendiente' : s === 'en_curso' ? 'Fijar en curso' : 'Fijar completado'}</button>
                </form>
              ))}
              {m.auto_status === false && (
                <form action={resetMilestoneAuto.bind(null, m.id)}><button className="btn ghost sm">Volver a automático</button></form>
              )}
              <form action={deleteMilestone.bind(null, m.id)}><button className="btn ghost sm">Quitar</button></form>
            </div>
          </details>
        )}
      />
      <form action={addMilestone} className="panel panel-pad stack" style={{ gap: 14 }}>
        <b style={{ fontWeight: 500 }}>Agregar al roadmap</b>
        <input type="hidden" name="org_id" value={org.id} />
        <div className="form-grid">
          <label className="field">Nombre<input className="input" name="title" required /></label>
          <label className="field">Tipo
            <select className="select" name="kind" defaultValue="fase">
              <option value="fase">Fase (dura hasta la siguiente)</option>
              <option value="hito">Hito (fecha puntual)</option>
            </select>
          </label>
          <label className="field">Fecha de inicio o del hito<input className="input" name="due_date" type="date" required /></label>
          <label className="field">Objetivo o detalle<input className="input" name="detail" /></label>
        </div>
        <div><button className="btn primary">Agregar</button></div>
      </form>
    </div>
  );
}
