import Link from 'next/link';
import { getOrgBySlug, requireViewer } from '@/lib/data';
import { DEMO } from '@/lib/env';
import { signOut } from '@/lib/actions';
import { Mark } from '@/components/Mark';
import { NavLink } from '@/components/NavLink';

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [v, org] = await Promise.all([requireViewer(), getOrgBySlug(slug)]);
  const base = `/c/${org.slug}`;
  return (
    <>
      {v.isStaff && (
        <div className="banner">
          Estás viendo el portal de {org.name} como lo ve el cliente. <Link href={`/panel/clientes/${org.slug}`}>Volver al panel</Link>
        </div>
      )}
      <div className="portal">
        <header className="portal-top">
          <Mark href={base} />
          <div className="row">
            <span className="muted small">{org.name}</span>
            {!DEMO && !v.isStaff && (
              <form action={signOut}>
                <button className="btn ghost sm">Salir</button>
              </form>
            )}
          </div>
        </header>
        <nav className="portal-nav" aria-label="Secciones">
          <NavLink href={base} exact>Inicio</NavLink>
          <NavLink href={`${base}/accionables`}>Accionables</NavLink>
          <NavLink href={`${base}/recursos`}>Recursos</NavLink>
          <NavLink href={`${base}/biblioteca`}>Biblioteca</NavLink>
          <NavLink href={`${base}/roadmap`}>Roadmap</NavLink>
        </nav>
        {children}
      </div>
    </>
  );
}
