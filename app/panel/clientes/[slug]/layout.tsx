import Link from 'next/link';
import { getOrgBySlug } from '@/lib/data';
import { STATUS_LABEL } from '@/lib/format';
import { NavLink } from '@/components/NavLink';

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const base = `/panel/clientes/${org.slug}`;
  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/panel/clientes" className="muted small" style={{ textDecoration: 'none' }}>Clientes</Link>
          <h1 style={{ marginTop: 4 }}>{org.name}</h1>
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
        <NavLink href={`${base}/roadmap`}>Roadmap</NavLink>
        <NavLink href={`${base}/accesos`}>Accesos</NavLink>
      </nav>
      {children}
    </>
  );
}
