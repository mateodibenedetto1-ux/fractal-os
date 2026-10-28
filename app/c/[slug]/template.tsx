/** Se vuelve a montar en cada navegación: da la entrada suave de cada página. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
