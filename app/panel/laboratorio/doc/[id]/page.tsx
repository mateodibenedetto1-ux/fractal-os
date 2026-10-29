import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/data';
import { notionPageMarkdown, isNotionId } from '@/lib/notion';
import { renderMarkdown } from '@/lib/md';
import { getLabPages } from '@/lib/data';

export default async function LabDoc({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isNotionId(id)) notFound();
  const page = (await getLabPages()).find((p) => p.notion_id === id);
  const meta = page ? { title: page.client ? `${page.client} — ${page.title}` : page.title, back: page.section === 'cliente' ? 'clientes' : 'criterios' } : null;
  const md = await notionPageMarkdown(id);
  return (
    <article>
      <Link href={`/panel/laboratorio?v=${meta?.back ?? 'resumen'}`} className="btn ghost sm" style={{ paddingLeft: 0 }}>Volver al Laboratorio</Link>
      <h1 className="serif" style={{ fontSize: 32, lineHeight: 1.15, margin: '12px 0 24px', maxWidth: '30ch' }}>{meta?.title ?? 'Documento'}</h1>
      {md ? (
        <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }} />
      ) : (
        <div className="panel panel-pad stack" style={{ gap: 10, maxWidth: 560 }}>
          <p>No pudimos leer este documento desde Notion.</p>
          <p className="muted small">Conectá la integración Fractal OS a la página <b>Fractal</b> en Notion (••• → Conexiones) para verlo acá.</p>
          <a className="btn sm" style={{ alignSelf: 'flex-start' }} href={`https://www.notion.so/${id}`} target="_blank" rel="noopener noreferrer">Abrir en Notion</a>
        </div>
      )}
    </article>
  );
}
