import { getCalls, getOrgBySlug, getResources } from '@/lib/data';
import { addResource, deleteResource } from '@/lib/actions';
import { Resources } from '@/components/Resources';
import { Icon } from '@/components/Icon';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const [items, calls] = await Promise.all([getResources(org.id), getCalls(org.id)]);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <form action={addResource} className="panel panel-pad stack" style={{ gap: 14 }}>
        <b style={{ fontWeight: 600 }}>Compartir un recurso</b>
        <input type="hidden" name="org_id" value={org.id} />
        <div className="form-grid">
          <label className="field">Link<input className="input" name="url" type="url" required placeholder="https://docs.google.com/…" /></label>
          <label className="field">Nombre<input className="input" name="title" placeholder="Biblia del cliente ideal" /></label>
        </div>
        <div><button className="btn primary">Compartir</button></div>
      </form>
      <Resources
        items={items}
        calls={calls}
        deleteSlot={(r) => (
          <form action={deleteResource.bind(null, r.id)}>
            <button className="btn ghost sm" aria-label={`Quitar ${r.title}`}><Icon name="trash" size={14} /></button>
          </form>
        )}
      />
    </div>
  );
}
