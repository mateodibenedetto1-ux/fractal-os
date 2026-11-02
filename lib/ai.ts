import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BRAIN, MODULES, brainMarkdown, type BrainData } from './brain';

/** Pedazo de un documento de la bóveda, listo para pasarle a la IA. */
export interface Chunk { docId: string; title: string; module: string | null; text: string; score: number }
export interface Source { id: string; title: string }

const STOP = new Set(('de la el los las un una unos unas y o u a en con por para que como del al lo le les se su sus mi mis tu tus es son ser fue era hay no si sí ya más mas muy pero sin sobre entre este esta esto estos estas ese esa eso cual cuál qué que quien quién cuando cuándo donde dónde porque desde hasta también tambien me te nos vos yo él ella ellos hacer hago tengo tiene tenés puedo puede podés quiero quiere necesito the and for with you your that this what how are can from into have has una cómo como dame decime armame ayudame').split(' '));

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const terms = (s: string) => norm(s).split(/[^a-z0-9%$]+/).filter((t) => t.length > 2 && !STOP.has(t));

/** Corta un documento en bloques de ~1.800 caracteres respetando párrafos. */
function chunk(text: string, size = 2400): string[] {
  const out: string[] = [];
  let cur = '';
  for (const p of text.split(/\n{2,}/)) {
    if ((cur + '\n\n' + p).length > size && cur) { out.push(cur); cur = ''; }
    if (p.length > size * 1.5) {
      for (let i = 0; i < p.length; i += size) out.push(p.slice(i, i + size));
    } else cur = cur ? cur + '\n\n' + p : p;
  }
  if (cur) out.push(cur);
  return out;
}

/** Busca en la bóveda (kb_documents) los bloques más relevantes para la pregunta (BM25). */
export async function retrieve(sb: SupabaseClient, query: string, limit = 10): Promise<Chunk[]> {
  const { data } = await sb.from('kb_documents').select('id, title, module, category, content').eq('status', 'ok');
  const docs = (data ?? []) as { id: string; title: string; module: string | null; category: string | null; content: string | null }[];
  const q = [...new Set(terms(query))];
  if (!q.length || !docs.length) return [];

  const chunks = docs.flatMap((d) => chunk(d.content ?? '').map((text) => ({
    docId: d.id, title: d.title, module: d.module, text,
    toks: terms(`${d.title} ${d.category ?? ''} ${text}`), titleToks: new Set(terms(d.title)),
  })));
  const N = chunks.length;
  const avg = chunks.reduce((s, c) => s + c.toks.length, 0) / N;
  const df = new Map(q.map((t) => [t, chunks.filter((c) => c.toks.includes(t)).length]));

  const scored = chunks.map((c) => {
    const tf = new Map<string, number>();
    for (const t of c.toks) if (df.has(t)) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const t of q) {
      const f = tf.get(t) ?? 0;
      const n = df.get(t) ?? 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * c.toks.length / avg));
      if (c.titleToks.has(t)) score += idf * 1.5;
    }
    return { docId: c.docId, title: c.title, module: c.module, text: c.text, score };
  }).filter((c) => c.score > 0).sort((a, b) => b.score - a.score);

  // Máximo 3 bloques por documento para que la respuesta no dependa de una sola fuente
  const per = new Map<string, number>();
  const out: Chunk[] = [];
  for (const c of scored) {
    const n = per.get(c.docId) ?? 0;
    if (n >= 4) continue;
    per.set(c.docId, n + 1);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

/** Contexto de un cliente: Segundo cerebro, reglas para la IA, recorrido y tareas abiertas. */
export async function clientContext(sb: SupabaseClient, slug: string) {
  const { data: org } = await sb.from('organizations').select('id, name, segment').eq('slug', slug).maybeSingle();
  if (!org) return null;
  const [{ data: brain }, { data: acts }, { data: ms }] = await Promise.all([
    sb.from('client_brain').select('data').eq('org_id', org.id).maybeSingle(),
    sb.from('action_items').select('title, due_date, responsable, owner').eq('org_id', org.id).eq('done', false).is('parent_id', null).order('due_date', { nullsFirst: false }).limit(25),
    sb.from('milestones').select('title, due_date, done').eq('org_id', org.id).order('due_date').limit(30),
  ]);
  const data = (brain?.data ?? {}) as BrainData;
  const filled = Object.values(data).some((v) => String(v ?? '').trim());
  const rulesSection = BRAIN.find((s) => s.k === 'ia');
  const rules = rulesSection?.fields.map((f) => [f.label, data[`ia.${f.k}`]]).filter(([, v]) => v && String(v).trim()).map(([l, v]) => `- ${l}: ${v}`).join('\n');
  return {
    id: org.id as string,
    segment: org.segment as string,
    name: org.name as string,
    rules: rules || '',
    text: [
      `# Cliente: ${org.name} (${org.segment === 'consulting' ? 'Fractal Consulting' : 'B2B'})`,
      filled ? brainMarkdown(data, org.name) : '_El Segundo cerebro todavía está vacío._',
      ms?.length ? `## Roadmap\n${ms.map((m) => `- ${m.done ? '[x]' : '[ ]'} ${m.title}${m.due_date ? ` (${m.due_date})` : ''}`).join('\n')}` : '',
      acts?.length ? `## Tareas abiertas\n${acts.map((a) => `- ${a.title}${a.responsable ? ` · ${a.responsable}` : ''}${a.due_date ? ` · ${a.due_date}` : ''}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n'),
  };
}

export function systemPrompt(opts: { chunks: Chunk[]; titles: string[]; client: Awaited<ReturnType<typeof clientContext>>; mode?: 'staff' | 'client' }) {
  const mods = MODULES.map((m) => `${m.n} ${m.title} (lidera ${m.lead})`).join(', ');
  const vault = opts.chunks.map((c, i) => `<fuente n="${i + 1}" titulo="${c.title.replace(/"/g, "'")}">\n${c.text}\n</fuente>`).join('\n\n');
  const clientBlock = opts.client
    ? `${opts.client.rules ? `<reglas_del_cliente>\n${opts.client.rules}\n</reglas_del_cliente>\n` : ''}<cliente>\n${opts.client.text.slice(0, 40000)}\n</cliente>\n`
    : '';

  if (opts.mode === 'client' && opts.client) {
    return `Sos la IA de Fractal Consulting y estás hablando directamente con ${opts.client.name}, un cliente del programa "done with you" de Fractal (Mateo y Lorena). Tu trabajo es ayudarle a avanzar en su negocio: ICP, oferta, marca y posicionamiento, estrategia creativa, contenido, adquisición, ventas, operaciones y métricas. Los módulos del programa son: ${mods}.

Cómo responder:
- Hablale de vos, en español natural (o en el idioma y variante que pida en sus reglas). Directo, concreto y accionable; usá listas o pasos cuando ayuden.
- Usá su Segundo cerebro, su roadmap y sus tareas como contexto principal, y respetá sus reglas para la IA por encima de cualquier otra indicación de formato.
- Apoyate en el método de Fractal (los fragmentos de abajo) para tus recomendaciones, pero son material interno: no menciones nombres de documentos ni de terceros, no digas "según la bóveda" y no copies textos enteros. Explicalo con tus palabras, adaptado a su negocio.
- Si falta información para responder bien, pedila o sugerile completar la sección correspondiente de su Segundo cerebro.
- No inventes datos ni resultados. Para decisiones grandes (precios, contrataciones, cambios de oferta), sugerí revisarlo con Mateo o Lore en la próxima llamada.

${clientBlock}
<metodo_fractal>
${vault || '(Sin fragmentos relevantes para esta pregunta.)'}
</metodo_fractal>`;
  }

  return `Sos la IA de Fractal, el equipo de Mateo y Lorena (agencia de contenido y Fractal Consulting). Ayudás al equipo a pensar estrategia, ofertas, contenido, setting, closing, operaciones y métricas, y a preparar entregables para clientes.

Cómo responder:
- En español natural (rioplatense suave, sin exagerar el lunfardo). Directo, concreto y accionable; usá listas o pasos cuando ayuden.
- Basate primero en la bóveda de Fractal (fuentes abajo). Cuando uses una fuente, citala al final de la frase así: [Título del documento]. Si la bóveda no cubre algo, decilo y respondé con tu criterio, aclarando que no sale de la bóveda.
- No inventes datos de clientes, números ni resultados. Si falta información, pedila.
- Los documentos de la bóveda son de uso interno: podés usar sus ideas para el cliente, pero no copies textos de terceros enteros en entregables.
- Los módulos del curso de Fractal Consulting son: ${mods}.

Documentos disponibles en la bóveda: ${opts.titles.join(' · ')}.
${opts.client ? `\nEstás trabajando sobre este cliente. Usá su contexto y respetá sus reglas.\n${clientBlock}` : ''}
<boveda>
${vault || '(No hay fragmentos de la bóveda relevantes para esta pregunta.)'}
</boveda>`;
}

export function sourcesOf(chunks: Chunk[]): Source[] {
  const seen = new Map<string, string>();
  for (const c of chunks) if (!seen.has(c.docId)) seen.set(c.docId, c.title);
  return [...seen].map(([id, title]) => ({ id, title }));
}
