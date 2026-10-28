import { getInbox, getRecentCalls, listClients } from '@/lib/data';
import { assignCall, deleteCall } from '@/lib/actions';
import { fmtDate } from '@/lib/format';
import Link from 'next/link';

export const metadata = { title: 'Reuniones' };

export default async function Meetings() {
  const [inbox, recent, clients] = await Promise.all([getInbox(), getRecentCalls(30), listClients()]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reuniones</h1>
          <p>Cada llamada de Fathom entra acá. Si reconocemos el email del cliente se asigna sola.</p>
        </div>
      </div>

      <h2 className="section-title">Sin asignar · {inbox.length}</h2>
      <ul className="list panel" style={{ marginBottom: 30 }}>
        {inbox.map((c) => (
          <li key={c.id} className="list-row wrap">
            <div className="grow" style={{ minWidth: 220 }}>
              <div style={{ fontWeight: 500 }}>{c.title}</div>
              <div className="muted small">{fmtDate(c.held_at)} · {c.invitee_emails.join(', ') || 'sin invitados externos'}</div>
            </div>
            <form action={assignCall} className="row wrap">
              <input type="hidden" name="call_id" value={c.id} />
              <select className="select" name="org_id" required defaultValue="" style={{ width: 200 }} aria-label="Cliente">
                <option value="" disabled>Elegir cliente</option>
                {clients.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <label className="row small"><input type="checkbox" name="remember" defaultChecked /> Recordar este email</label>
              <button className="btn primary sm">Asignar</button>
            </form>
            <form action={deleteCall.bind(null, c.id)}><button className="btn ghost sm" title="Por ejemplo, una llamada interna o de venta">Descartar</button></form>
          </li>
        ))}
        {!inbox.length && <li className="empty">No hay llamadas esperando cliente.</li>}
      </ul>

      <h2 className="section-title">Recientes</h2>
      <ul className="list panel">
        {recent.filter((c) => c.org).map((c) => (
          <li key={c.id}>
            <Link href={`/panel/clientes/${c.org!.slug}/llamadas`} className="list-row">
              <div className="grow">
                <div style={{ fontWeight: 500 }}>{c.title}</div>
                <div className="muted small">{c.org!.name} · {fmtDate(c.held_at)}</div>
              </div>
              <span className={`tag ${c.status === 'procesada' ? 'ok' : c.status === 'error' ? 'warn' : ''}`}>
                {c.status === 'procesada' ? 'Procesada' : c.status === 'error' ? 'Error' : 'Procesando'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
