import Link from 'next/link';
import { getAgency, getAllOpenActions, getTeamTasks, listClients } from '@/lib/data';
import { addAction, syncClientNow } from '@/lib/actions';
import { DEMO } from '@/lib/env';
import { fmtShort, PRIORITY_LABEL } from '@/lib/format';
import { ActionList } from '@/components/ActionList';

export const metadata = { title: 'Tareas' };

const ORDER = { critica: 0, alta: 1, media: 2, baja: 3 } as const;
const AREAS = ['Creative', 'Editing', 'Publishing', 'Operations', 'Client Success', 'Metrics', 'Systems'];

export default async function Tasks({ searchParams }: { searchParams: Promise<{ de?: string }> }) {
  const { de = 'tracker' } = await searchParams;
  const [all, agency, clients] = await Promise.all([getAllOpenActions(), getAgency(), listClients()]);
  const open = all.filter((a) => (a.org as { kind?: string }).kind !== 'agency');
  const team = agency ? await getTeamTasks(agency.id) : [];
  const teamOpen = team.filter((a) => !a.done && !a.parent_id).length;

  const tabs = [
    { k: 'tracker', l: `Tracker Fractal · ${teamOpen}` },
    { k: 'fractal', l: `De Fractal en clientes · ${open.filter((a) => a.owner === 'fractal').length}` },
    { k: 'cliente', l: `De los clientes · ${open.filter((a) => a.owner === 'cliente').length}` },
    { k: 'todos', l: 'Todas' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tareas</h1>
          <p>{de === 'tracker' ? 'El tracker interno del equipo. Se sincroniza con Tasks Tracker Fractal en Notion.' : 'Todo lo abierto en las subcuentas, ordenado por prioridad.'}</p>
        </div>
        {de === 'tracker' && agency && (
          <form action={syncClientNow.bind(null, agency.id)}>
            <button className="btn">Traer cambios de Notion</button>
          </form>
        )}
      </div>
      <nav className="tabs">
        {tabs.map((t) => (
          <Link key={t.k} href={`/panel/tareas?de=${t.k}`} aria-current={de === t.k ? 'page' : undefined}>{t.l}</Link>
        ))}
      </nav>

      {de === 'tracker' ? (
        agency ? (
          <div className="stack" style={{ gap: 20 }}>
            <details className="panel panel-pad disclose">
              <summary className="row between"><b style={{ fontWeight: 600 }}>Agregar tarea</b><span className="btn sm">Abrir</span></summary>
              <form action={addAction} className="stack" style={{ gap: 14, marginTop: 16 }}>
                <input type="hidden" name="org_id" value={agency.id} />
                <input type="hidden" name="owner" value="fractal" />
                <label className="field">Qué hay que hacer<input className="input" name="title" required /></label>
                <label className="field">Entregable o nota<input className="input" name="why" /></label>
                <div className="form-grid">
                  <label className="field">Responsable
                    <select className="select" name="responsable" defaultValue="">
                      <option value="">Sin asignar</option>
                      {(agency.responsables ?? []).map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                    </select>
                  </label>
                  <label className="field">Cliente
                    <select className="select" name="client_org_id" defaultValue="">
                      <option value="">Interna de Fractal</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label className="field">Prioridad
                    <select className="select" name="priority" defaultValue="alta"><option value="alta">P1</option><option value="media">P2</option><option value="baja">P3</option></select>
                  </label>
                  <label className="field">Fecha límite<input className="input" name="due_date" type="date" /></label>
                  <label className="field">Área
                    <select className="select" name="area" defaultValue="">
                      <option value="">Sin área</option>
                      {AREAS.map((a) => <option key={a}>{a}</option>)}
                    </select>
                  </label>
                </div>
                <div><button className="btn primary">Agregar</button></div>
              </form>
            </details>
            <ActionList
              items={team}
              calls={[]}
              staff
              demo={DEMO}
              responsables={agency.responsables ?? []}
              clientNames={Object.fromEntries(clients.map((c) => [c.id, c.name]))}
              progressLabel="Avance del equipo"
              flatLabel="Tracker Fractal"
            />
          </div>
        ) : (
          <div className="panel empty">El tracker de Fractal no está conectado.</div>
        )
      ) : (
        <ul className="list panel">
          {open
            .filter((a) => (de === 'todos' ? true : a.owner === de))
            .sort((a, b) => (ORDER[a.priority ?? 'baja'] ?? 4) - (ORDER[b.priority ?? 'baja'] ?? 4) || (a.due_date ?? '9').localeCompare(b.due_date ?? '9'))
            .map((a) => (
              <li key={a.id}>
                <Link href={`/panel/clientes/${a.org.slug}/accionables`} className="list-row">
                  <div className="grow">
                    <div>{a.title}</div>
                    <div className="muted small">{a.org.name}{a.responsable ? ` · ${a.responsable}` : ''}{a.area ? ` · ${a.area}` : ''}</div>
                  </div>
                  {a.priority && <span className={`tag ${a.priority === 'critica' || a.priority === 'alta' ? 'warn' : ''}`}>{PRIORITY_LABEL[a.priority]}</span>}
                  {a.due_date && <span className="muted small">{fmtShort(a.due_date)}</span>}
                </Link>
              </li>
            ))}
        </ul>
      )}
    </>
  );
}
