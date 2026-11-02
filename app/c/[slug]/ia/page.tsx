import { notFound } from 'next/navigation';
import { getOrgBySlug } from '@/lib/data';
import { getAiKeyStatus } from '@/lib/aikeys';
import { DEMO } from '@/lib/env';
import { FractalChat } from '@/components/FractalChat';
import { AiKeyConnect } from '@/components/AiKeyConnect';

export const metadata = { title: 'Fractal IA' };

export default async function PortalIa({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  if (org.segment !== 'consulting') notFound();
  const key = DEMO ? { connected: false, hint: null, verified_at: null } : await getAiKeyStatus(org.id);
  return (
    <>
      <section className="hello">
        <h1>Fractal IA</h1>
        <p>Tu consultor disponible todo el tiempo. Conoce tu Segundo cerebro, tu roadmap y el método de Fractal, así que podés pedirle ideas, guiones, revisiones de tu oferta o ayuda para decidir.</p>
      </section>
      <div style={{ marginTop: 26 }} className="stack">
        <AiKeyConnect orgId={org.id} connected={key.connected} hint={key.hint} />
        {key.connected && (
          <FractalChat
            fixedClient={org.slug}
            mode="client"
            intro="Preguntame lo que necesites sobre tu negocio. Mientras más completo esté tu Segundo cerebro, mejores van a ser mis respuestas."
          />
        )}
      </div>
    </>
  );
}
