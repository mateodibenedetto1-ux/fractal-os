import Anthropic from '@anthropic-ai/sdk';
import { getViewer } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';
import { clientContext, retrieve, sourcesOf, systemPrompt } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Msg = { role: 'user' | 'assistant'; content: string };

export async function POST(req: Request) {
  const v = await getViewer();
  if (!v?.isStaff) return new Response('No autorizado', { status: 401 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return new Response('Falta configurar ANTHROPIC_API_KEY en Vercel.', { status: 503 });

  const body = (await req.json().catch(() => null)) as { messages?: Msg[]; client?: string } | null;
  const messages = (body?.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim()).slice(-14);
  if (!messages.length || messages[messages.length - 1].role !== 'user') return new Response('Mensaje vacío', { status: 400 });

  // La búsqueda usa la última pregunta y, si es corta, la anterior también (para seguir el hilo)
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const query = users.slice(-2).join(' ');
  const sb = await supabaseServer();
  const [chunks, client, { data: titles }] = await Promise.all([
    retrieve(query, 10),
    body?.client ? clientContext(body.client) : Promise.resolve(null),
    sb.from('kb_documents').select('title').eq('status', 'ok').order('title'),
  ]);
  const sources = sourcesOf(chunks);
  const system = systemPrompt({ chunks, titles: (titles ?? []).map((t) => t.title as string), client });

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
        const hint = /401|authentication|invalid x-api-key/i.test(msg)
          ? 'La clave de Anthropic configurada en Vercel no es válida. Actualizá ANTHROPIC_API_KEY y volvé a desplegar.'
          : /credit|billing|402/i.test(msg) ? 'La cuenta de Anthropic no tiene saldo.' : `No pude responder: ${msg}`;
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
