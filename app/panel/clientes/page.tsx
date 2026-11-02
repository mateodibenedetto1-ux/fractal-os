import Link from 'next/link';
import { listClients } from '@/lib/data';
import { createClientAccount } from '@/lib/actions';
import { relative, STATUS_LABEL } from '@/lib/format';
import { Cells } from '@/components/Cells';

export const metadata = { title: 'Clientes' };

export default async function Clients({ searchParams }: { searchParams: Promise<{ seg?: string }> }) {
  const { seg = 'b2b' } = await searchParams;
  const all = await listClients();
  const clients = all.filter((c) => (c.segment ?? 'b2b') === seg);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clientes</h1>
          <p>Cada cliente es una subcuenta con su propio portal. B2B: lo hacemos por ellos. Consulting: lo construyen con nosotros.</p>
        </div>
        <a href="#nuevo" className="btn">Nuevo cliente</a>
      </div>
      <nav className="tabs">
        {[{ k: 'b2b', l: 'B2B' }, { k: 'consulting', l: 'Consulting' }].map((t) => (
          <Link key={t.k} href={`/panel/clientes?seg=${t.k}`} aria-current={seg === t.k ? 'page' : undefined}>
            {t.l} · {all.filter((c) => (c.segment ?? 'b2b') === t.k).length}
          </Link>
        ))}
      </nav>

      <ul className="list panel" style={{ marginBottom: 32 }}>
        {clients.map((c) => (
          <li key={c.id}>
            <Link href={`/panel/clientes/${c.slug}`} className="list-row">
              <div className="grow">
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  <span className={`tag ${c.status === 'activo' ? 'ok' : c.status === 'onboarding' ? 'brand' : ''}`}>{STATUS_LABEL[c.status]}</span>
                </div>
                <div className="muted small">
                  {[c.offer, c.program_month ? `Mes ${c.program_month}` : null, c.contact_name].filter(Boolean).join(' · ') || 'Sin datos'}
                </div>
              </div>
              <div className="stack" style={{ alignItems: 'flex-end', gap: 6, maxWidth: 180 }}>
                <Cells done={c.total - c.pending} total={c.total} />
                <span className="muted small">{c.pending} pendientes · {relative(c.lastCallAt)}</span>
              </div>
            </Link>
          </li>
        ))}
        {!clients.length && <li className="empty">{seg === 'consulting' ? 'Todavía no hay clientes de Consulting. Crealos abajo eligiendo el tipo Consulting.' : 'Todavía no hay clientes B2B.'}</li>}
      </ul>

      <section id="nuevo" className="panel panel-pad">
        <h2 className="serif" style={{ fontSize: 24, marginBottom: 4 }}>Nuevo cliente</h2>
        <p className="muted small" style={{ marginBottom: 18 }}>
          Los dominios o emails sirven para que las llamadas de Fathom se asignen solas a este cliente.
        </p>
        <form action={createClientAccount} className="stack" style={{ gap: 14 }}>
          <div className="form-grid">
            <label className="field">Nombre del cliente<input className="input" name="name" required /></label>
            <label className="field">Tipo
              <select className="select" name="segment" defaultValue={seg}>
                <option value="b2b">B2B · lo hacemos por ellos</option>
                <option value="consulting">Consulting · lo construyen con nosotros</option>
              </select>
            </label>
            <label className="field">Contacto principal<input className="input" name="contact_name" /></label>
            <label className="field">Email del contacto<input className="input" name="contact_email" type="email" /></label>
            <label className="field">Dominios o emails para Fathom<input className="input" name="email_domains" placeholder="empresa.com, persona@gmail.com" /></label>
            <label className="field">Oferta
              <select className="select" name="offer" defaultValue="Consultoría">
                <option>Consultoría</option><option>B2B</option><option>Contenido</option><option>Advisory</option>
              </select>
            </label>
            <label className="field">Estado
              <select className="select" name="status" defaultValue="onboarding">
                {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label className="field">Fecha de inicio<input className="input" name="start_date" type="date" /></label>
          </div>
          <div><button className="btn primary">Crear cliente</button></div>
        </form>
      </section>
    </>
  );
}
