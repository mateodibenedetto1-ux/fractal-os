import { notFound } from 'next/navigation';
import { getBrain, getMilestones, getOrgBySlug } from '@/lib/data';
import { startJourney } from '@/lib/actions';
import { DEMO } from '@/lib/env';
import { BrainEditor } from '@/components/BrainEditor';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  if (org.segment !== 'consulting') notFound();
  const [data, milestones] = await Promise.all([getBrain(org.id), getMilestones(org.id)]);
  const started = milestones.some((m) => m.brain_section);
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="panel panel-pad row between wrap" style={{ gap: 12 }}>
        <div className="grow" style={{ minWidth: 260 }}>
          <b style={{ fontWeight: 500 }}>{started ? 'Recorrido Fractal creado' : 'Crear el Recorrido Fractal'}</b>
          <p className="muted small" style={{ marginTop: 3 }}>
            {started
              ? 'Cada sección es una etapa del roadmap con sus tareas: ver la clase, completar la sección y revisarla con Fractal. Volver a crearlo reemplaza esas fases y tareas.'
              : 'Genera una fase por sección desde la fecha de inicio, con tres tareas en cada una. Las de completar se tildan solas al llegar al 80 %.'}
          </p>
        </div>
        <form action={startJourney.bind(null, org.id)}>
          <button className={`btn ${started ? '' : 'primary'}`}>{started ? 'Volver a crear' : 'Crear recorrido'}</button>
        </form>
      </div>
      <BrainEditor orgId={org.id} name={org.name} initial={data} demo={DEMO} />
    </div>
  );
}
