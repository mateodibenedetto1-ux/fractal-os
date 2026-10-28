import { getMembers, requireViewer } from '@/lib/data';
import { inviteClientUser, updateMyName } from '@/lib/actions';
import { DEMO } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';

export const metadata = { title: 'Ajustes' };

export default async function Settings() {
  let agencyId = '';
  if (!DEMO) {
    const sb = await supabaseServer();
    const { data } = await sb.from('organizations').select('id').eq('kind', 'agency').limit(1).single();
    agencyId = data?.id ?? '';
  }
  const team = agencyId ? await getMembers(agencyId) : [];
  const me = await requireViewer();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ajustes</h1>
          <p>El equipo de Fractal ve y edita todas las subcuentas.</p>
        </div>
      </div>
      <form action={updateMyName} className="panel panel-pad row wrap" style={{ marginBottom: 20, gap: 14, alignItems: 'flex-end' }}>
        <label className="field grow" style={{ minWidth: 220 }}>Tu nombre
          <input className="input" name="full_name" defaultValue={me.name} required />
        </label>
        <button className="btn primary">Guardar nombre</button>
      </form>
      <div className="two">
        <section>
          <h2 className="section-title">Equipo</h2>
          <ul className="list panel">
            {team.map((m) => (
              <li key={m.email} className="list-row">
                <div className="grow">
                  <div style={{ fontWeight: 500 }}>{m.name || m.email}</div>
                  <div className="muted small">{m.email}</div>
                </div>
                <span className="tag">{m.role === 'owner' ? 'Dueño' : m.role === 'admin' ? 'Admin' : 'Equipo'}</span>
              </li>
            ))}
            {!team.length && <li className="empty">Sin miembros cargados.</li>}
          </ul>
        </section>
        <form action={inviteClientUser} className="panel panel-pad stack" style={{ gap: 14 }}>
          <b style={{ fontWeight: 600 }}>Sumar a alguien del equipo</b>
          <input type="hidden" name="org_id" value={agencyId} />
          <input type="hidden" name="role" value="member" />
          <label className="field">Nombre<input className="input" name="name" /></label>
          <label className="field">Email<input className="input" name="email" type="email" required /></label>
          <div><button className="btn primary">Enviar invitación</button></div>
        </form>
      </div>
    </>
  );
}
