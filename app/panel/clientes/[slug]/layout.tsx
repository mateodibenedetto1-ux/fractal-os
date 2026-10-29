import Link from 'next/link';
import { getOrgBySlug } from '@/lib/data';
import { STATUS_LABEL } from '@/lib/format';
import { NavLink } from '@/components/NavLink';
import { Icon } from '@/components/Icon';

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const base = `/panel/clientes/${org.slug}`;
  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/panel/clientes" className="back-link"><Icon name="back" size={15} /> Todos los clientes</Link>
          <h1 style={{ marginTop: 10 }}>{org.name}</h1>
          <p>
            {STATUS_LABEL[org.status]}
            {org.offer ? ` · ${org.offer}` : ''}
            {org.program_month ? ` · Mes ${org.program_month}` : ''}
          </p>
        </div>
        <Link href={`/c/${org.slug}`} className="btn">Ver portal del cliente</Link>
      </div>
      <nav className="tabs" aria-label="Secciones del cliente">
        <NavLink href={base} exact>Resumen</NavLink>
        <NavLink href={`${base}/accionables`}>Accionables</NavLink>
        <NavLink href={`${base}/llamadas`}>Llamadas</NavLink>
        <NavLink href={`${base}/recursos`}>Recursos</NavLink>
        <NavLink href={`${base}/biblioteca`}>Biblioteca</NavLink>
        <NavLink href={`${base}/calendario`}>Calendario</NavLink>
        <NavLink href={`${base}/roadmap`}>Roadmap</NavLink>
        <NavLink href={`${base}/accesos`}>Accesos</NavLink>
      </nav>
      {children}
    </>
  );
}
