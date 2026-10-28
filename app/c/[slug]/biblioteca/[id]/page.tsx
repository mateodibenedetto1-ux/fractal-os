import Link from 'next/link';
import { getDoc, getOrgBySlug } from '@/lib/data';
import { fmtDate } from '@/lib/format';
import { renderMarkdown } from '@/lib/md';

export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const org = await getOrgBySlug(slug);
  const doc = await getDoc(org.id, id);
  return (
    <article>
      <Link href={`/c/${org.slug}/biblioteca`} className="btn ghost sm" style={{ paddingLeft: 0 }}>Volver a la biblioteca</Link>
      <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.1, margin: '14px 0 8px' }}>{doc.title}</h1>
      <p className="muted" style={{ marginBottom: 32 }}>{fmtDate(doc.created_at)}</p>
      <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.body_md) }} />
    </article>
  );
}
