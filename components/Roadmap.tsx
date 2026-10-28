import { fmtDate } from '@/lib/format';
import type { Milestone } from '@/lib/types';

const LABEL = { pendiente: 'Pendiente', en_curso: 'En curso', listo: 'Listo' } as const;

/** Hitos en secuencia: acá la numeración sí es información (es un orden real). */
export function Roadmap({ items, controls }: { items: Milestone[]; controls?: (m: Milestone) => React.ReactNode }) {
  if (!items.length) return <div className="panel empty">El roadmap todavía no tiene hitos.</div>;
  return (
    <ol className="list panel">
      {items.map((m, i) => (
        <li key={m.id} className="list-row" style={{ alignItems: 'flex-start' }}>
          <span
            className="serif"
            style={{
              width: 30, height: 30, flex: 'none', borderRadius: '50%', display: 'grid', placeContent: 'center', fontSize: 15,
              background: m.status === 'listo' ? 'var(--brand)' : 'transparent',
              color: m.status === 'listo' ? 'var(--brand-ink)' : 'var(--ink-2)',
              border: `1.5px solid ${m.status === 'pendiente' ? 'var(--line)' : 'var(--brand)'}`,
            }}
          >
            {i + 1}
          </span>
          <div className="grow">
            <div style={{ fontWeight: 500 }}>{m.title}</div>
            {m.detail && <div className="muted small">{m.detail}</div>}
          </div>
          <div className="stack" style={{ alignItems: 'flex-end', gap: 6 }}>
            <span className={`tag ${m.status === 'listo' ? 'ok' : m.status === 'en_curso' ? 'brand' : ''}`}>{LABEL[m.status]}</span>
            {m.due_date && <span className="muted small">{fmtDate(m.due_date, { day: 'numeric', month: 'short' })}</span>}
            {controls?.(m)}
          </div>
        </li>
      ))}
    </ol>
  );
}
