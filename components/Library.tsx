'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Doc } from '@/lib/types';
import { DOC_KIND } from '@/lib/doc-kinds';

const SHELF_TEXT: Record<Doc['kind'], string> = {
  estrategia: 'Planes y documentos de dirección.',
  diagnostico: 'Tu cliente ideal, tu marca, tu producto y tus objetivos de base.',
  sop: 'Cómo se hace cada proceso, paso a paso.',
  reporte: 'El resumen de cada semana de trabajo.',
  objetivos: 'Las metas de cada semana y etapa.',
  resumen: 'Lo que hablamos y decidimos en cada llamada.',
  nota: 'Apuntes sueltos.',
};

const SPINE: Record<Doc['kind'], string> = {
  estrategia: 'var(--brand)', diagnostico: '#8a6bb8', sop: 'var(--ok)', reporte: 'var(--focus)',
  objetivos: 'var(--warn)', resumen: 'var(--ink-2)', nota: 'var(--muted)',
};

const ORDER = Object.keys(DOC_KIND) as Doc['kind'][];
const date = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

export function Library({ docs, base }: { docs: Doc[]; base: string }) {
  const [q, setQ] = useState('');
  if (!docs.length) {
    return <div className="panel empty">La biblioteca está vacía. Después de cada llamada se guarda acá un resumen con lo que hablamos.</div>;
  }
  const term = q.trim().toLowerCase();
  const visible = term ? docs.filter((d) => d.title.toLowerCase().includes(term)) : docs;
  const shelves = ORDER.map((k) => ({ k, list: visible.filter((d) => d.kind === k) })).filter((s) => s.list.length);

  return (
    <div className="library">
      <aside className="lib-index">
        <input className="input" type="search" placeholder="Buscar un documento" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en la biblioteca" />
        <nav aria-label="Estantes">
          {shelves.map((s) => (
            <a key={s.k} href={`#estante-${s.k}`}>
              <i style={{ background: SPINE[s.k] }} />{DOC_KIND[s.k]}<span>{s.list.length}</span>
            </a>
          ))}
        </nav>
      </aside>
      <div className="stack" style={{ gap: 30, minWidth: 0 }}>
        {shelves.map((s) => (
          <section key={s.k} id={`estante-${s.k}`} className="shelf">
            <header>
              <h2>{DOC_KIND[s.k]}</h2>
              <p className="muted small">{SHELF_TEXT[s.k]}</p>
            </header>
            <div className="books">
              {s.list.map((d) => (
                <Link key={d.id} href={`${base}/${d.id}`} className="book">
                  <span className="spine" style={{ background: SPINE[s.k] }} />
                  <span className="book-title">{d.title}</span>
                  <span className="book-meta">
                    {date(d.created_at)}
                    {!d.visible_to_client && ' · solo equipo'}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
        {!shelves.length && <div className="panel empty">No hay documentos que coincidan con la búsqueda.</div>}
      </div>
    </div>
  );
}
