import { getActions, getCalls, getOrgBySlug } from '@/lib/data';
import { addAction } from '@/lib/actions';
import { DEMO } from '@/lib/env';
import { fmtDate } from '@/lib/format';
import { ActionList } from '@/components/ActionList';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const [actions, calls] = await Promise.all([getActions(org.id), getCalls(org.id)]);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <details className="panel panel-pad disclose">
        <summary className="row between"><b style={{ fontWeight: 600 }}>Agregar accionable</b><span className="btn sm">Abrir</span></summary>
        <form action={addAction} className="stack" style={{ gap: 14, marginTop: 16 }}>
          <input type="hidden" name="org_id" value={org.id} />
          <label className="field">Qué hay que hacer<input className="input" name="title" required /></label>
          <label className="field">Por qué importa<input className="input" name="why" placeholder="El motivo de negocio, en una frase" /></label>
          <div className="form-grid">
            <label className="field">Llamada
              <select className="select" name="call_id" defaultValue={calls[0]?.id ?? ''}>
                <option value="">Sin llamada</option>
                {calls.map((c) => <option key={c.id} value={c.id}>{c.title} · {fmtDate(c.held_at)}</option>)}
              </select>
            </label>
            <label className="field">Dentro de
              <select className="select" name="parent_id" defaultValue="">
                <option value="">Accionable principal</option>
                {actions.filter((a) => !a.parent_id && !a.done).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </label>
            <label className="field">Lo hace
              <select className="select" name="owner" defaultValue="cliente"><option value="cliente">El cliente</option><option value="fractal">Fractal</option></select>
            </label>
            <label className="field">Prioridad
              <select className="select" name="priority" defaultValue=""><option value="">Sin prioridad</option><option value="critica">Crítica</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select>
            </label>
            <label className="field">Área<input className="input" name="area" list="areas" /></label>
            <label className="field">Fecha límite<input className="input" name="due_date" type="date" /></label>
          </div>
          <datalist id="areas">{['Marketing', 'Contenido', 'Comercial', 'Operaciones', 'Adquisición', 'Producto', 'Branding', 'Métricas', 'General'].map((a) => <option key={a} value={a} />)}</datalist>
          <div><button className="btn primary">Agregar</button></div>
        </form>
      </details>
      <ActionList items={actions} calls={calls} staff demo={DEMO} initialFilter="todos" />
    </div>
  );
}
