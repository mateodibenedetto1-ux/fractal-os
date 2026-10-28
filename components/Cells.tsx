/** Progreso "fractal": una celda por accionable, rellena cuando está hecho. */
export function Cells({ done, total, size }: { done: number; total: number; size?: 'lg' }) {
  const n = Math.min(total, 60);
  const on = total > 60 ? Math.round((done / total) * 60) : done;
  return (
    <div className={`cells ${size ?? ''}`} role="img" aria-label={`${done} de ${total} completados`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`cell ${i < on ? 'on' : ''}`} />
      ))}
    </div>
  );
}
