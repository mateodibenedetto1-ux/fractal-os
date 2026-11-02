import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getKbDoc } from '@/lib/data';
import { MODULES } from '@/lib/brain';

export default async function KbDocPage({ params }: { params: Promise<{ id: string }> }) {
  const doc = await getKbDoc((await params).id);
  if (!doc) notFound();
  const mod = MODULES.find((m) => m.k === doc.module);
  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/panel/laboratorio?v=conocimiento" className="back-link">← Conocimiento</Link>
          <h1 style={{ marginTop: 10 }}>{doc.title}</h1>
          <p>{[doc.category, mod && `Módulo ${mod.n} · ${mod.title}`, `${doc.chars.toLocaleString('es-AR')} caracteres`].filter(Boolean).join(' · ')}</p>
        </div>
        {doc.source_url && <a href={doc.source_url} target="_blank" rel="noreferrer" className="btn">Abrir original</a>}
      </div>
      {doc.status !== 'ok' && <div className="panel panel-pad" style={{ marginBottom: 16, borderColor: 'var(--warn)' }}>{doc.note ?? 'No se pudo leer el texto de este documento.'}</div>}
      <article className="panel panel-pad kb-text">{doc.content}</article>
    </>
  );
}
