import { fmtDate, hostOf } from '@/lib/format';
import type { Call, Resource } from '@/lib/types';
import { Icon } from './Icon';
import { ResourceSearch } from './ResourceSearch';

const GROUPS: { label: string; kinds: Resource['kind'][] }[] = [
  { label: 'Documentos y SOPs', kinds: ['doc', 'page'] },
  { label: 'Hojas de cálculo', kinds: ['sheet'] },
  { label: 'Presentaciones', kinds: ['slides'] },
  { label: 'Videos', kinds: ['video'] },
  { label: 'Carpetas', kinds: ['folder'] },
  { label: 'Links', kinds: ['link'] },
];

export function Resources({ items, calls, deleteSlot }: { items: Resource[]; calls: Pick<Call, 'id' | 'held_at'>[]; deleteSlot?: (r: Resource) => React.ReactNode }) {
  if (!items.length) {
    return <div className="panel empty">Todavía no hay recursos. Cada documento, hoja o carpeta que te compartamos en una llamada aparece acá.</div>;
  }
  const callDate = (id: string | null) => {
    const c = calls.find((x) => x.id === id);
    return c ? `compartido en tu llamada del ${fmtDate(c.held_at)}` : `agregado el ${fmtDate(items.find((r) => r.call_id === id)?.created_at)}`;
  };
  return (
    <ResourceSearch>
      {GROUPS.map((g) => {
        const list = items.filter((r) => g.kinds.includes(r.kind));
        if (!list.length) return null;
        return (
          <section key={g.label} data-group style={{ marginBottom: 24 }}>
            <h2 className="section-title">
              {g.label} · {list.length}
            </h2>
            <ul className="list panel">
              {list.map((r) => (
                <li key={r.id} data-search={`${r.title} ${r.description ?? ''}`.toLowerCase()}>
                  <div className="list-row">
                    <span className="res-icon">
                      <Icon name={r.kind} />
                    </span>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="grow" style={{ textDecoration: 'none' }}>
                      <div style={{ fontWeight: 500 }}>{r.title}</div>
                      <div className="muted small">
                        {hostOf(r.url)} · {r.call_id ? callDate(r.call_id) : `agregado el ${fmtDate(r.created_at)}`}
                      </div>
                    </a>
                    {deleteSlot?.(r)}
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn ghost sm" aria-label={`Abrir ${r.title}`}>
                      <Icon name="arrow" size={15} />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </ResourceSearch>
  );
}
