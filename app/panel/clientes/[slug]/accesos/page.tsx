import { getMembers, getOrgBySlug } from '@/lib/data';
import { inviteClientUser } from '@/lib/actions';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const members = await getMembers(org.id);
  return (
    <div className="two">
      <section>
        <h2 className="section-title">Personas con acceso al portal</h2>
        <ul className="list panel">
          {members.map((m) => (
            <li key={m.email} className="list-row">
              <div className="grow">
                <div style={{ fontWeight: 500 }}>{m.name || m.email}</div>
                <div className="muted small">{m.email}</div>
              </div>
            </li>
          ))}
          {!members.length && <li className="empty">Nadie tiene acceso todavía. Invitá al cliente con su email.</li>}
        </ul>
      </section>
      <form action={inviteClientUser} className="panel panel-pad stack" style={{ gap: 14 }}>
        <b style={{ fontWeight: 600 }}>Invitar al portal</b>
        <p className="muted small">Le llega un email para crear su contraseña y entra directo a su espacio.</p>
        <input type="hidden" name="org_id" value={org.id} />
        <label className="field">Nombre<input className="input" name="name" /></label>
        <label className="field">Email<input className="input" name="email" type="email" required /></label>
        <div><button className="btn primary">Enviar invitación</button></div>
      </form>
    </div>
  );
}
