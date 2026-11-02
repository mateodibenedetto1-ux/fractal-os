import { notFound } from 'next/navigation';
import { getBrain, getBrainMeta, getMilestones, getOrgBySlug } from '@/lib/data';
import { startJourney } from '@/lib/actions';
import { DEMO } from '@/lib/env';
import { BrainEditor } from '@/components/BrainEditor';

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ s?: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  if (org.segment !== 'consulting') notFound();
  const [data, milestones, meta] = await Promise.all([getBrain(org.id), getMilestones(org.id), getBrainMeta(org.id)]);
  const started = milestones.some((m) => m.brain_section);
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="panel panel-pad row between wrap" style={{ gap: 12 }}>
        <div className="grow" style={{ minWidth: 260 }}>
          <b style={{ fontWeight: 500 }}>{started ? 'Recorrido Fractal creado' : 'Crear el Recorrido Fractal'}</b>
          <p className="muted small" style={{ marginTop: 3 }}>
            {started
              ? 'Los 9 módulos del curso son las fases del roadmap (3 meses), cada una con sus tareas: ver las clases, completar sus secciones y revisarlas con Mateo o Lore. Volver a crearlo reemplaza esas fases y tareas.'
              : 'Genera los 9 módulos del curso como fases de 3 meses desde la fecha de inicio, con sus tareas. Las de completar se tildan solas cuando la sección llega al 80 %.'}
          </p>
        </div>
        <form action={startJourney.bind(null, org.id)}>
          <button className={`btn ${started ? '' : 'primary'}`}>{started ? 'Volver a crear' : 'Crear recorrido'}</button>
        </form>
      </div>
      <BrainEditor orgId={org.id} name={org.name} initial={data} demo={DEMO} roadmap={meta} initialSection={(await searchParams).s} staff roadmapHref={`/panel/clientes/${org.slug}/roadmap`} />
    </div>
  );
}
