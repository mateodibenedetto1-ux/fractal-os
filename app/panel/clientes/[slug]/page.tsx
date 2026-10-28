import { getActions, getCalls, getOrgBySlug } from '@/lib/data';
import { updateClientAccount } from '@/lib/actions';
import { fmtDate, STATUS_LABEL } from '@/lib/format';
import { Cells } from '@/components/Cells';

export default async function Overview({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const [actions, calls] = await Promise.all([getActions(org.id), getCalls(org.id)]);
  const tops = actions.filter((a) => !a.parent_id);
  const done = tops.filter((a) => a.done).length;
  const doneRecently = tops.filter((a) => a.done_at && Date.now() - new Date(a.done_at).getTime() < 7 * 864e5).length;

  return (
    <div className="two">
      <form action={updateClientAccount} className="panel panel-pad stack" style={{ gap: 16 }}>
        <input type="hidden" name="id" value={org.id} />
        <label className="field">Próximo paso
          <textarea className="textarea" name="next_step" defaultValue={org.next_step ?? ''} style={{ minHeight: 70 }} placeholder="La única cosa que más mueve a este cliente ahora" />
        </label>
        <div className="form-grid">
          <label className="field">Nombre<input className="input" name="name" defaultValue={org.name} required /></label>
          <label className="field">Estado
            <select className="select" name="status" defaultValue={org.status}>
              {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="field">Oferta<input className="input" name="offer" defaultValue={org.offer ?? ''} /></label>
          <label className="field">Mes del programa<input className="input" name="program_month" type="number" min={1} max={24} defaultValue={org.program_month ?? ''} /></label>
          <label className="field">Fecha de inicio<input className="input" name="start_date" type="date" defaultValue={org.start_date ?? ''} /></label>
          <label className="field">Contacto<input className="input" name="contact_name" defaultValue={org.contact_name ?? ''} /></label>
          <label className="field">Email del contacto<input className="input" name="contact_email" type="email" defaultValue={org.contact_email ?? ''} /></label>
          <label className="field">Dominios o emails para Fathom<input className="input" name="email_domains" defaultValue={org.email_domains.join(', ')} /></label>
        </div>
        <h3 className="section-title" style={{ margin: '6px 0 0' }}>Accesos rápidos del portal</h3>
        <div className="form-grid">
          <label className="field">Drive<input className="input" name="drive_url" type="url" defaultValue={org.drive_url ?? ''} /></label>
          <label className="field">Tracker de métricas<input className="input" name="tracker_url" type="url" defaultValue={org.tracker_url ?? ''} /></label>
          <label className="field">Programa / plataforma<input className="input" name="program_url" type="url" defaultValue={org.program_url ?? ''} /></label>
          <label className="field">Notion (referencia interna)<input className="input" name="notion_url" type="url" defaultValue={org.notion_url ?? ''} /></label>
        </div>
        <div><button className="btn primary">Guardar cambios</button></div>
      </form>

      <aside className="stack" style={{ gap: 14 }}>
        <div className="panel panel-pad stack" style={{ gap: 12 }}>
          <span className="muted small">Avance en accionables</span>
          <span className="serif" style={{ fontSize: 32, lineHeight: 1 }}>{done} de {tops.length}</span>
          <Cells done={done} total={tops.length} />
          <span className="muted small">{doneRecently} completados en los últimos 7 días</span>
        </div>
        <div className="panel panel-pad stack" style={{ gap: 6 }}>
          <span className="muted small">Llamadas</span>
          <span className="serif" style={{ fontSize: 32, lineHeight: 1 }}>{calls.length}</span>
          <span className="muted small">{calls[0] ? `Última el ${fmtDate(calls[0].held_at)}` : 'Todavía no hubo llamadas'}</span>
        </div>
      </aside>
    </div>
  );
}
