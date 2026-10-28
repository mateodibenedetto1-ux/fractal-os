import Link from 'next/link';
import { fmtDate } from '@/lib/format';
import type { Doc } from '@/lib/types';
import { Icon } from './Icon';

export const DOC_KIND: Record<Doc['kind'], string> = {
  resumen: 'Resúmenes de llamadas',
  estrategia: 'Estrategia',
  diagnostico: 'Diagnósticos',
  sop: 'SOPs',
  nota: 'Notas',
};

export function Library({ docs, base }: { docs: Doc[]; base: string }) {
  if (!docs.length) {
    return <div className="panel empty">La biblioteca está vacía. Después de cada llamada se guarda acá un resumen con lo que hablamos.</div>;
  }
  const kinds = (Object.keys(DOC_KIND) as Doc['kind'][]).filter((k) => docs.some((d) => d.kind === k));
  return (
    <>
      {kinds.map((k) => (
        <section key={k} style={{ marginBottom: 24 }}>
          <h2 className="section-title">{DOC_KIND[k]}</h2>
          <ul className="list panel">
            {docs.filter((d) => d.kind === k).map((d) => (
              <li key={d.id}>
                <Link href={`${base}/${d.id}`} className="list-row">
                  <span className="res-icon">
                    <Icon name="book" />
                  </span>
                  <div className="grow">
                    <div style={{ fontWeight: 500 }}>{d.title}</div>
                    <div className="muted small">
                      {fmtDate(d.created_at)}
                      {!d.visible_to_client && ' · solo equipo'}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
