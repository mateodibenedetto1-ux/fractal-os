import { saveDoc } from '@/lib/actions';
import type { Doc } from '@/lib/types';
import { DOC_KIND } from '@/lib/doc-kinds';

export function DocEditor({ orgId, doc }: { orgId: string; doc?: Doc }) {
  return (
    <form action={saveDoc} className="stack" style={{ gap: 14 }}>
      <input type="hidden" name="org_id" value={orgId} />
      {doc && <input type="hidden" name="id" value={doc.id} />}
      <div className="form-grid">
        <label className="field">Título<input className="input" name="title" required defaultValue={doc?.title} /></label>
        <label className="field">Tipo
          <select className="select" name="kind" defaultValue={doc?.kind ?? 'estrategia'}>
            {Object.entries(DOC_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <label className="field">Contenido (Markdown)
        <textarea className="textarea" name="body_md" defaultValue={doc?.body_md} style={{ minHeight: 360, fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
      </label>
      <label className="row small"><input type="checkbox" name="visible_to_client" defaultChecked={doc?.visible_to_client ?? true} /> Visible para el cliente</label>
      <div><button className="btn primary">{doc ? 'Guardar documento' : 'Crear documento'}</button></div>
    </form>
  );
}
