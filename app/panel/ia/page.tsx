import { listClients } from '@/lib/data';
import { FractalChat } from '@/components/FractalChat';

export const metadata = { title: 'Fractal IA' };

export default async function IaPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const [clients, { c }] = await Promise.all([listClients(), searchParams]);
  const ai = Boolean(process.env.ANTHROPIC_API_KEY);
  return (
    <>
      <header className="ai-head">
        <h1>Fractal IA</h1>
        <p className="muted small">La bóveda de Fractal a mano. Solo la ve el equipo.</p>
      </header>
      {!ai && <div className="panel panel-pad" style={{ marginBottom: 16, borderColor: 'var(--warn)' }}>Falta la clave de Anthropic (ANTHROPIC_API_KEY) en Vercel. Sin ella el chat no puede responder.</div>}
      <FractalChat clients={clients.map((x) => ({ slug: x.slug, name: x.name }))} initialClient={c} />
    </>
  );
}
