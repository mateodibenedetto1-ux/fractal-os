import Link from 'next/link';
import { getAllOpenActions } from '@/lib/data';
import { fmtShort, PRIORITY_LABEL } from '@/lib/format';

export const metadata = { title: 'Tareas' };

const ORDER = { critica: 0, alta: 1, media: 2, baja: 3 } as const;

export default async function Tasks({ searchParams }: { searchParams: Promise<{ de?: string }> }) {
  const { de = 'fractal' } = await searchParams;
  const all = await getAllOpenActions();
  const list = all
    .filter((a) => (de === 'todos' ? true : a.owner === de))
    .sort((a, b) => (ORDER[a.priority ?? 'baja'] ?? 4) - (ORDER[b.priority ?? 'baja'] ?? 4) || (a.due_date ?? '9').localeCompare(b.due_date ?? '9'));
  const tabs = [
    { k: 'fractal', l: `Equipo Fractal · ${all.filter((a) => a.owner === 'fractal').length}` },
    { k: 'cliente', l: `Clientes · ${all.filter((a) => a.owner === 'cliente').length}` },
    { k: 'todos', l: 'Todas' },
  ];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tareas</h1>
          <p>Todo lo abierto en todas las subcuentas, ordenado por prioridad.</p>
        </div>
      </div>
      <nav className="tabs">
        {tabs.map((t) => (
          <Link key={t.k} href={`/panel/tareas?de=${t.k}`} aria-current={de === t.k ? 'page' : undefined}>{t.l}</Link>
        ))}
      </nav>
      <ul className="list panel">
        {list.map((a) => (
          <li key={a.id}>
            <Link href={`/panel/clientes/${a.org.slug}/accionables`} className="list-row">
              <div className="grow">
                <div>{a.title}</div>
                <div className="muted small">{a.org.name}{a.area ? ` · ${a.area}` : ''}</div>
              </div>
              {a.priority && <span className={`tag ${a.priority === 'critica' || a.priority === 'alta' ? 'warn' : ''}`}>{PRIORITY_LABEL[a.priority]}</span>}
              {a.due_date && <span className="muted small">{fmtShort(a.due_date)}</span>}
            </Link>
          </li>
        ))}
        {!list.length && <li className="empty">No hay tareas abiertas en esta vista.</li>}
      </ul>
    </>
  );
}
