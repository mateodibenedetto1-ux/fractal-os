import Link from 'next/link';
import { getAllOpenActions, getInbox, getRecentCalls, getViewer, listClients } from '@/lib/data';
import { fmtShort, relative, STATUS_LABEL } from '@/lib/format';
import { Cells } from '@/components/Cells';

export const metadata = { title: 'Home' };

export default async function PanelHome() {
  const [v, clients, open, inbox, recent] = await Promise.all([getViewer(), listClients(), getAllOpenActions(), getInbox(), getRecentCalls(6)]);
  const active = clients.filter((c) => c.status === 'activo' || c.status === 'onboarding');
  const stale = active.filter((c) => !c.lastCallAt || Date.now() - new Date(c.lastCallAt).getTime() > 14 * 864e5);
  const fractalOwned = open.filter((a) => a.owner === 'fractal');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hola, {v?.name.split(' ')[0]}</h1>
          <p>Así están tus clientes hoy.</p>
        </div>
        <Link href="/panel/clientes#nuevo" className="btn primary">Nuevo cliente</Link>
      </div>

      <div className="kpis">
        <div className="panel kpi"><b>{active.length}</b><span>clientes activos</span></div>
        <div className="panel kpi"><b>{open.length - fractalOwned.length}</b><span>accionables abiertos de clientes</span></div>
        <div className="panel kpi"><b>{fractalOwned.length}</b><span>pendientes del equipo Fractal</span></div>
        <div className="panel kpi"><b>{stale.length}</b><span>sin llamada hace más de 14 días</span></div>
      </div>

      {inbox.length > 0 && (
        <Link href="/panel/reuniones" className="panel panel-pad row" style={{ marginBottom: 20, textDecoration: 'none', borderColor: 'var(--brand)' }}>
          <span className="tag brand">{inbox.length}</span>
          <span className="grow">
            {inbox.length === 1 ? 'Hay una llamada de Fathom' : `Hay ${inbox.length} llamadas de Fathom`} sin cliente asignado. Asignala para generar los accionables.
          </span>
        </Link>
      )}

      <div className="two">
        <section>
          <h2 className="section-title">Clientes</h2>
          <ul className="list panel">
            {active.map((c) => (
              <li key={c.id}>
                <Link href={`/panel/clientes/${c.slug}`} className="list-row">
                  <div className="grow">
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div className="muted small">{c.next_step ?? 'Sin próximo paso definido'}</div>
                  </div>
                  <div className="stack" style={{ alignItems: 'flex-end', gap: 6, maxWidth: 210 }}>
                    <Cells done={c.total - c.pending} total={c.total} />
                    <span className="muted small">{c.lastCallAt ? `última llamada ${relative(c.lastCallAt)}` : "sin llamadas todavía"}</span>
                  </div>
                </Link>
              </li>
            ))}
            {!active.length && <li className="empty">Todavía no hay clientes. Creá el primero desde Clientes.</li>}
          </ul>
        </section>
        <section>
          <h2 className="section-title">Últimas llamadas</h2>
          <ul className="list panel">
            {recent.map((c) => (
              <li key={c.id} className="list-row">
                <div className="grow">
                  <div style={{ fontWeight: 500 }}>{c.title}</div>
                  <div className="muted small">
                    {c.org ? c.org.name : 'Sin asignar'} · {fmtShort(c.held_at)}
                  </div>
                </div>
                {c.status === 'error' && <span className="tag warn">Error</span>}
              </li>
            ))}
            {!recent.length && <li className="empty">Las llamadas de Fathom aparecen acá apenas terminan.</li>}
          </ul>
          <h2 className="section-title" style={{ marginTop: 22 }}>Estado de la cartera</h2>
          <div className="panel panel-pad stack" style={{ gap: 8 }}>
            {Object.entries(STATUS_LABEL).map(([k, label]) => (
              <div key={k} className="row between small">
                <span>{label}</span>
                <span className="muted">{clients.filter((c) => c.status === k).length}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
