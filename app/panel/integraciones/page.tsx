import { getConnections } from '@/lib/data';
import { createConnection, deleteConnection, saveConnectionSecret } from '@/lib/actions';
import { APP_URL } from '@/lib/env';
import { fmtDate } from '@/lib/format';

export const metadata = { title: 'Integraciones' };

export default async function Integrations() {
  const conns = await getConnections();
  const ai = Boolean(process.env.ANTHROPIC_API_KEY);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Integraciones</h1>
          <p>Conectá Fathom para que cada llamada genere accionables, resumen y recursos sola.</p>
        </div>
      </div>

      <section className="panel panel-pad" style={{ marginBottom: 20 }}>
        <div className="row between wrap" style={{ marginBottom: 14 }}>
          <b style={{ fontWeight: 600 }}>Fathom</b>
          <span className={`tag ${ai ? 'ok' : 'warn'}`}>{ai ? 'Claude procesa las llamadas en español' : 'Sin Claude: se usan los action items de Fathom (en inglés)'}</span>
        </div>
        <ol className="small" style={{ margin: '0 0 18px', paddingLeft: 18, color: 'var(--ink-2)', lineHeight: 1.7 }}>
          <li>Creá una conexión por cada persona del equipo que graba llamadas.</li>
          <li>En Fathom: Settings → API Access → Manage → Add Webhook. Pegá la URL de la conexión.</li>
          <li>Marcá incluir transcript, summary y action items, y elegí &ldquo;My recordings&rdquo;.</li>
          <li>Copiá el secreto que te da Fathom (empieza con whsec_) y guardalo acá abajo.</li>
        </ol>
        <ul className="list" style={{ border: '1px solid var(--line-soft)', borderRadius: 'var(--r)' }}>
          {conns.map((c) => (
            <li key={c.id} className="stack" style={{ gap: 10, padding: '14px 16px' }}>
              <div className="row between wrap">
                <b style={{ fontWeight: 500 }}>{c.label}</b>
                <span className="muted small">{c.last_event_at ? `Última llamada recibida el ${fmtDate(c.last_event_at)}` : 'Todavía no recibió llamadas'}</span>
              </div>
              <input className="input" readOnly value={`${APP_URL}/api/webhooks/fathom/${c.id}`} aria-label="URL del webhook" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }} />
              <form action={saveConnectionSecret} className="row wrap">
                <input type="hidden" name="id" value={c.id} />
                <input className="input grow" name="secret" placeholder={c.webhook_secret ? 'Secreto guardado. Pegá otro para reemplazarlo.' : 'whsec_…'} style={{ minWidth: 220 }} />
                <button className="btn sm">Guardar secreto</button>
              </form>
              <form action={deleteConnection.bind(null, c.id)}><button className="btn ghost sm">Quitar conexión</button></form>
            </li>
          ))}
          {!conns.length && <li className="empty">Todavía no hay conexiones.</li>}
        </ul>
        <form action={createConnection} className="row wrap" style={{ marginTop: 14 }}>
          <input className="input" name="label" placeholder="Nombre de quien graba, por ejemplo Mateo" style={{ maxWidth: 320 }} required />
          <button className="btn primary sm">Crear conexión</button>
        </form>
      </section>

      <section className="panel panel-pad">
        <b style={{ fontWeight: 600 }}>Notion</b>
        <p className="muted small" style={{ marginTop: 6 }}>
          La importación trae clientes, tareas, roadmap y biblioteca desde tu workspace. Se corre una vez con <code>npm run import:notion</code> (ver README).
        </p>
      </section>
    </>
  );
}
