import { notFound } from 'next/navigation';
import { getBrain, getBrainMeta, getOrgBySlug } from '@/lib/data';
import { DEMO } from '@/lib/env';
import { BrainEditor } from '@/components/BrainEditor';

export const metadata = { title: 'Segundo cerebro' };

export default async function Cerebro({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ s?: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  if (org.segment !== 'consulting') notFound();
  const [data, meta] = await Promise.all([getBrain(org.id), getBrainMeta(org.id)]);
  return (
    <>
      <header className="ai-head">
        <h1>Tu Segundo cerebro</h1>
        <p className="muted small">Tu marca, tu cliente, tu oferta y tu operación. Escribilo con tus palabras: de acá salen tu roadmap y la IA.</p>
      </header>
      <div style={{ marginTop: 18 }}>
        <BrainEditor orgId={org.id} name={org.name} initial={data} demo={DEMO} roadmap={meta} initialSection={(await searchParams).s} roadmapHref={`/c/${org.slug}/roadmap`} />
      </div>
    </>
  );
}
