import { notFound } from 'next/navigation';
import { getBrain, getOrgBySlug } from '@/lib/data';
import { DEMO } from '@/lib/env';
import { BrainEditor } from '@/components/BrainEditor';

export const metadata = { title: 'Segundo cerebro' };

export default async function Cerebro({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  if (org.segment !== 'consulting') notFound();
  const data = await getBrain(org.id);
  return (
    <>
      <section className="hello">
        <h1>Tu Segundo cerebro</h1>
        <p>Todo lo que define tu marca, tu cliente, tu oferta y tu operación, en un solo lugar. La IA de Fractal lo lee en cada conversación: escribilo con tus palabras y con datos reales.</p>
      </section>
      <div style={{ marginTop: 30 }}>
        <BrainEditor orgId={org.id} name={org.name} initial={data} demo={DEMO} />
      </div>
    </>
  );
}
