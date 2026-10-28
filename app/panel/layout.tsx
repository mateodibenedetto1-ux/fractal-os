import { requireStaff } from '@/lib/data';
import { DEMO } from '@/lib/env';
import { signOut } from '@/lib/actions';
import { Mark } from '@/components/Mark';
import { NavLink } from '@/components/NavLink';
import { Icon } from '@/components/Icon';

const NAV = [
  { href: '/panel', label: 'Home', icon: 'home', exact: true },
  { href: '/panel/clientes', label: 'Clientes', icon: 'users' },
  { href: '/panel/tareas', label: 'Tareas', icon: 'check' },
  { href: '/panel/reuniones', label: 'Reuniones', icon: 'video' },
  { href: '/panel/integraciones', label: 'Integraciones', icon: 'plug' },
  { href: '/panel/ajustes', label: 'Ajustes', icon: 'gear' },
];
const SOON = [
  { label: 'Calendario', icon: 'calendar' },
  { label: 'Objetivos', icon: 'target' },
  { label: 'Laboratorios', icon: 'flask' },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const v = await requireStaff();
  return (
    <>
      {DEMO && <div className="banner">Modo demo con datos de ejemplo. Conectá Supabase para usar tus datos reales.</div>}
      <div className="shell">
        <aside className="side">
          <Mark href="/panel" />
          <nav aria-label="Panel">
            {NAV.map((n) => (
              <NavLink key={n.href} href={n.href} className="nav" exact={n.exact}>
                <Icon name={n.icon} /> {n.label}
              </NavLink>
            ))}
          </nav>
          <nav aria-label="Próximamente">
            <span className="group">Próximamente</span>
            {SOON.map((n) => (
              <span key={n.label} className="nav">
                <Icon name={n.icon} /> {n.label}
              </span>
            ))}
          </nav>
          <div className="row" style={{ marginTop: 'auto', padding: '0 10px' }}>
            <span className="small grow muted">{v.name}</span>
            {!DEMO && (
              <form action={signOut}>
                <button className="btn ghost sm" aria-label="Salir"><Icon name="out" /></button>
              </form>
            )}
          </div>
        </aside>
        <main className="main">{children}</main>
      </div>
    </>
  );
}
