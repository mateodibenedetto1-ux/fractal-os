import { getMilestones, getOrgBySlug } from '@/lib/data';
import { addMilestone, deleteMilestone, setMilestoneStatus } from '@/lib/actions';
import { Roadmap } from '@/components/Roadmap';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const items = await getMilestones(org.id);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <Roadmap
        items={items}
        controls={(m) => (
          <div className="row" style={{ gap: 4 }}>
            {m.status !== 'en_curso' && <form action={setMilestoneStatus.bind(null, m.id, 'en_curso')}><button className="btn ghost sm">En curso</button></form>}
            {m.status !== 'listo' && <form action={setMilestoneStatus.bind(null, m.id, 'listo')}><button className="btn ghost sm">Listo</button></form>}
            <form action={deleteMilestone.bind(null, m.id)}><button className="btn ghost sm">Quitar</button></form>
          </div>
        )}
      />
      <form action={addMilestone} className="panel panel-pad stack" style={{ gap: 14 }}>
        <b style={{ fontWeight: 600 }}>Agregar hito</b>
        <input type="hidden" name="org_id" value={org.id} />
        <div className="form-grid">
          <label className="field">Hito<input className="input" name="title" required /></label>
          <label className="field">Detalle<input className="input" name="detail" /></label>
          <label className="field">Fecha objetivo<input className="input" name="due_date" type="date" /></label>
        </div>
        <div><button className="btn primary">Agregar hito</button></div>
      </form>
    </div>
  );
}
