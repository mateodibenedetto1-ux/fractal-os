/** Isotipo: un cubo dividido en tres caras, en el oxblood de Fractal. */
export function Cube({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 21 7 12 12 3 7Z" fill="var(--brand)" />
      <path d="M3 7 12 12 12 22 3 17Z" fill="var(--brand)" opacity=".72" />
      <path d="M21 7 12 12 12 22 21 17Z" fill="var(--brand)" opacity=".48" />
    </svg>
  );
}

export function Mark({ href = '/', label = 'FRACTAL' }: { href?: string; label?: string }) {
  return (
    <a className="mark" href={href}>
      <Cube />
      <span>{label}</span>
    </a>
  );
}
