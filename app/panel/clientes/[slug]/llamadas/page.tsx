import { getCalls, getOrgBySlug } from '@/lib/data';
import { addManualCall, deleteCall, reprocessCall } from '@/lib/actions';
import { fmtDate } from '@/lib/format';

const STATE = { pendiente: 'Procesando', procesada: 'Procesada', error: 'Error' } as const;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const calls = await getCalls(org.id);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <ul className="list panel">
        {calls.map((c) => (
          <li key={c.id} className="list-row">
            <div className="grow">
              <div style={{ fontWeight: 500 }}>{c.title}</div>
              <div className="muted small">
                {fmtDate(c.held_at)} · {c.source === 'fathom' ? 'Fathom' : c.source === 'notion' ? 'Importada de Notion' : 'Carga manual'}
                {c.error ? ` · ${c.error}` : ''}
              </div>
            </div>
            <span className={`tag ${c.status === 'procesada' ? 'ok' : c.status === 'error' ? 'warn' : ''}`}>{STATE[c.status]}</span>
            {c.share_url && <a className="btn sm" href={c.share_url} target="_blank" rel="noopener noreferrer">Grabación</a>}
            {c.source !== 'notion' && (
              <form action={reprocessCall.bind(null, c.id)}><button className="btn sm" title="Vuelve a generar accionables y resumen">Regenerar</button></form>
            )}
            <form action={deleteCall.bind(null, c.id)}><button className="btn ghost sm">Borrar</button></form>
          </li>
        ))}
        {!calls.length && <li className="empty">Todavía no hay llamadas. Llegan solas desde Fathom o podés cargar una abajo.</li>}
      </ul>

      <details className="panel panel-pad disclose">
        <summary className="row between"><b style={{ fontWeight: 600 }}>Cargar una llamada a mano</b><span className="btn sm">Abrir</span></summary>
        <p className="muted small" style={{ margin: '10px 0 16px' }}>
          Para llamadas que no grabó Fathom. Pegá el transcript y se generan el resumen, los accionables y los recursos igual que con Fathom.
        </p>
        <form action={addManualCall} className="stack" style={{ gap: 14 }}>
          <input type="hidden" name="org_id" value={org.id} />
          <div className="form-grid">
            <label className="field">Título<input className="input" name="title" defaultValue="Llamada 1:1" /></label>
            <label className="field">Fecha<input className="input" name="held_at" type="datetime-local" /></label>
            <label className="field">Link de la grabación<input className="input" name="share_url" type="url" /></label>
          </div>
          <label className="field">Transcript<textarea className="textarea" name="transcript" required style={{ minHeight: 220 }} /></label>
          <div><button className="btn primary">Procesar llamada</button></div>
        </form>
      </details>
    </div>
  );
}
