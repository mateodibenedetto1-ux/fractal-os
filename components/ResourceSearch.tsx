'use client';
import { useEffect, useRef, useState } from 'react';

/** Filtra en el navegador los recursos renderizados por el servidor. */
export function ResourceSearch({ children }: { children: React.ReactNode }) {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const term = q.trim().toLowerCase();
    root.querySelectorAll<HTMLElement>('[data-search]').forEach((li) => {
      li.hidden = !!term && !li.dataset.search!.includes(term);
    });
    root.querySelectorAll<HTMLElement>('[data-group]').forEach((g) => {
      g.hidden = !g.querySelector('[data-search]:not([hidden])');
    });
  }, [q]);
  return (
    <div ref={ref}>
      <input
        className="input"
        type="search"
        placeholder="Buscar un documento, hoja o carpeta"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: 340, marginBottom: 22 }}
        aria-label="Buscar recursos"
      />
      {children}
    </div>
  );
}
