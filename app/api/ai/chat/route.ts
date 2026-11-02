import Anthropic from '@anthropic-ai/sdk';
import { getViewer } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { clientContext, retrieve, sourcesOf, systemPrompt } from '@/lib/ai';
import { getOrgAiKey } from '@/lib/aikeys';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Msg = { role: 'user' | 'assistant'; content: string };

/**
 * Chat de Fractal IA.
 * - Equipo (panel): usa la key de Fractal y cita los documentos de la bóveda.
 * - Cliente de consultoría (portal, mode "client"): usa la API key propia del cliente y no expone la bóveda.
 */
export async function POST(req: Request) {
  const v = await getViewer();
  if (!v) return new Response('No autorizado', { status: 401 });

  const body = (await req.json().catch(() => null)) as { messages?: Msg[]; client?: string; mode?: 'staff' | 'client' } | null;
  const messages = (body?.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim()).slice(-14);
  if (!messages.length || messages[messages.length - 1].role !== 'user') return new Response('Mensaje vacío', { status: 400 });

  const mode = !v.isStaff || body?.mode === 'client' ? 'client' : 'staff';
  if (mode === 'client' && !body?.client) return new Response('Falta el cliente', { status: 400 });

  // La bóveda solo la lee el servidor; el cliente nunca recibe los documentos.
  const admin = supabaseAdmin();
  const sb = await supabaseServer();
  const client = body?.client ? await clientContext(sb, body.client) : null;
  if (body?.client && !client) return new Response('Cliente no encontrado', { status: 404 });

  let key: string | null | undefined;
  if (mode === 'client') {
    if (!v.isStaff && !v.clientOrgIds.includes(client!.id)) return new Response('No autorizado', { status: 403 });
    if (client!.segment !== 'consulting') return new Response('Fractal IA es parte de Fractal Consulting.', { status: 403 });
    key = await getOrgAiKey(client!.id);
    if (!key) return new Response('Conectá tu API key de Anthropic para usar Fractal IA.', { status: 402 });
  } else {
    key = process.env.ANTHROPIC_API_KEY;
    if (!key) return new Response('Falta configurar ANTHROPIC_API_KEY en Vercel.', { status: 503 });
  }

  // La búsqueda usa la última pregunta y la anterior (para seguir el hilo)
  const query = messages.filter((m) => m.role === 'user').map((m) => m.content).slice(-2).join(' ');
  const [chunks, { data: titles }] = await Promise.all([
    retrieve(admin, query, 16),
    admin.from('kb_documents').select('title').eq('status', 'ok').order('title'),
  ]);
  const sources = mode === 'staff' ? sourcesOf(chunks) : [];
  const system = systemPrompt({ chunks, titles: (titles ?? []).map((t) => t.title as string), client, mode });

  const anthropic = new Anthropic({ apiKey: key });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        const s = anthropic.messages.stream({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
          max_tokens: 4000,
          system,
          messages,
        });
        for await (const ev of s) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') ctrl.enqueue(enc.encode(ev.delta.text));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const own = mode === 'client';
        const hint = /401|authentication|invalid x-api-key/i.test(msg)
          ? own ? 'Tu API key de Anthropic ya no es válida. Desconectala y conectá una nueva.' : 'La clave de Anthropic configurada en Vercel no es válida. Actualizá ANTHROPIC_API_KEY y volvé a desplegar.'
          : /credit|billing|balance|402/i.test(msg)
            ? own ? 'Tu cuenta de Anthropic no tiene saldo. Cargá créditos en console.anthropic.com → Billing y volvé a intentar.' : 'La cuenta de Anthropic de Fractal no tiene saldo.'
            : /429|rate/i.test(msg) ? 'Llegaste al límite de uso por minuto de Anthropic. Esperá un momento y volvé a intentar.'
              : `No pude responder: ${msg}`;
        ctrl.enqueue(enc.encode(`\n\n⚠️ ${hint}`));
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-sources': encodeURIComponent(JSON.stringify(sources)),
    },
  });
}
