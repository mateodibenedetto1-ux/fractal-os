import { notFound } from 'next/navigation';
import { getOrgBySlug } from '@/lib/data';
import { getAiKeyStatus } from '@/lib/aikeys';
import { DEMO } from '@/lib/env';
import { FractalChat } from '@/components/FractalChat';
import { AiKeyConnect } from '@/components/AiKeyConnect';

export const metadata = { title: 'Fractal IA' };

export default async function ClientIa({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  if (org.segment !== 'consulting') notFound();
  const key = DEMO ? { connected: false, hint: null, verified_at: null } : await getAiKeyStatus(org.id);
  return (
    <div className="stack">
      <div className="panel panel-pad">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <b>IA del cliente</b>
            <p className="muted small">
              En su portal, {org.name} usa Fractal IA con su propia API key de Anthropic. Acá respondés vos con la key de Fractal y la bóveda completa, con su contexto cargado.
            </p>
          </div>
          {key.connected
            ? <AiKeyConnect orgId={org.id} connected hint={key.hint} />
            : <span className="tag">Todavía no conectó su API key</span>}
        </div>
      </div>
      {!key.connected && <AiKeyConnect orgId={org.id} connected={false} hint={null} compact />}
      <FractalChat fixedClient={org.slug} mode="staff" />
    </div>
  );
}
