import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './supabase/admin';
import { BRAIN, MODULES, brainMarkdown, brainPct, type BrainData } from './brain';
import { NOTION_MARKER, notionPageMarkdown } from './notion';
import { retrieve } from './ai';
import { pushActionToNotion } from './sync';

/** Con este porcentaje del Segundo cerebro completo se crea el roadmap personalizado. */
export const ROADMAP_THRESHOLD = 80;

const DAY = 864e5;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(new Date(s + 'T12:00:00').getTime() + n * DAY));
const weeksBetween = (a: string, b: string) => Math.max(1, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / (7 * DAY)) + 1);

interface Plan {
  resumen_md: string;
  hitos: { title: string; detalle?: string; semana: number }[];
  tareas: { title: string; por_que?: string; owner?: 'cliente' | 'fractal'; responsable?: string; semana: number; area?: string; prioridad?: 'critica' | 'alta' | 'media' | 'baja' }[];
}

const TOOL: Anthropic.Tool = {
  name: 'guardar_roadmap',
  description: 'Guarda el roadmap personalizado del cliente.',
  input_schema: {
    type: 'object',
    properties: {
      resumen_md: { type: 'string', description: 'Documento en Markdown para el cliente.' },
      hitos: {
        type: 'array',
        items: { type: 'object', properties: { title: { type: 'string' }, detalle: { type: 'string' }, semana: { type: 'integer', minimum: 1, maximum: 12 } }, required: ['title', 'semana'] },
      },
      tareas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' }, por_que: { type: 'string' },
            owner: { type: 'string', enum: ['cliente', 'fractal'] }, responsable: { type: 'string' },
            semana: { type: 'integer', minimum: 1, maximum: 12 },
            area: { type: 'string' }, prioridad: { type: 'string', enum: ['critica', 'alta', 'media', 'baja'] },
          },
          required: ['title', 'semana'],
        },
      },
    },
    required: ['resumen_md', 'hitos', 'tareas'],
  },
};

/** Junta el estándar de Fractal: roadmaps y estrategias de todos los clientes + la bóveda. */
async function fractalStandard(orgId: string) {
  const sb = supabaseAdmin();
  const { data: orgs } = await sb.from('organizations').select('id, name, start_date, segment, offer').eq('kind', 'client').neq('id', orgId);
  const ids = (orgs ?? []).map((o) => o.id);
  const [{ data: ms }, { data: docs }] = await Promise.all([
    sb.from('milestones').select('org_id, title, detail, due_date, kind').in('org_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']).is('brain_section', null).order('due_date'),
    sb.from('documents').select('org_id, title, kind, body_md, notion_id').in('org_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
      .or('kind.in.(estrategia,objetivos,diagnostico,sop),title.ilike.%roadmap%,title.ilike.%estrategia%,title.ilike.%direcci%')
      .order('updated_at', { ascending: false }).limit(14),
  ]);

  const roadmaps = (orgs ?? []).map((o) => {
    const list = (ms ?? []).filter((m) => m.org_id === o.id && m.due_date);
    if (!list.length) return '';
    const start = o.start_date ?? list[0].due_date!;
    return `### ${o.name}${o.offer ? ` (${o.offer})` : ''}\n${list.slice(0, 40).map((m) => `- Semana ${weeksBetween(start, m.due_date!)} · ${m.kind === 'fase' ? 'FASE' : 'hito'}: ${m.title}${m.detail ? ` — ${String(m.detail).slice(0, 160)}` : ''}`).join('\n')}`;
  }).filter(Boolean).join('\n\n');

  // Estrategias y roadmaps en documentos (los que vienen de Notion se leen de Notion, como máximo 6)
  let budget = 36000;
  let notionReads = 0;
  const strategy: string[] = [];
  for (const d of docs ?? []) {
    if (budget <= 0) break;
    let body = String(d.body_md ?? '');
    if (body.startsWith(NOTION_MARKER) && d.notion_id && notionReads < 6) {
      notionReads++;
      body = (await notionPageMarkdown(d.notion_id).catch(() => null)) ?? '';
    }
    body = body.replace(NOTION_MARKER, '').trim();
    if (body.length < 200) continue;
    const name = (orgs ?? []).find((o) => o.id === d.org_id)?.name ?? '';
    const chunk = body.slice(0, Math.min(6000, budget));
    budget -= chunk.length;
    strategy.push(`### ${d.title} (${name})\n${chunk}`);
  }

  // Bóveda: roadmaps de referencia y lo más relevante sobre fases y crecimiento
  const { data: refs } = await sb.from('kb_documents').select('title, content').eq('status', 'ok').ilike('title', '%roadmap%');
  const vault = (refs ?? []).map((r) => `### ${r.title}\n${String(r.content ?? '').slice(0, 8000)}`);
  const chunks = await retrieve(sb, 'roadmap fases oferta adquisición contenido ventas lanzamiento escalar sistema operaciones métricas', 8);
  vault.push(...chunks.map((c) => `### ${c.title}\n${c.text}`));

  return { roadmaps, strategy: strategy.join('\n\n'), vault: vault.join('\n\n') };
}

const SYSTEM = `Sos el estratega de Fractal Consulting (Mateo lidera oferta, adquisición, ventas, operaciones, métricas y sistemas; Lorena lidera creatividad, posicionamiento, narrativa y contenido).
Tu trabajo es crear el roadmap personalizado de 12 semanas de un cliente que acaba de completar su Segundo cerebro.

Cómo hacerlo:
- Basate en TODO lo que escribió el cliente en su Segundo cerebro (punto de partida, cliente ideal, oferta, marca, narrativa, estrategia creativa, contenido, adquisición, ventas, operación, métricas), no solo en sus objetivos.
- Usá como estándar cómo armamos los roadmaps, estrategias creativas y de marketing de los demás clientes de Fractal: las fases típicas, el orden, los tiempos y el tipo de hitos se repiten. Replicá ese patrón y adaptalo a este negocio.
- El programa sigue los 9 módulos del curso en este orden y duración: {MODULOS}. Los hitos y tareas tienen que caer en la semana que corresponde a su módulo, salvo que el negocio necesite adelantar algo (por ejemplo, un lanzamiento ya planificado).
- hitos: entre 6 y 10 logros concretos y verificables del negocio (no "ver clases"): ej. "Oferta validada con 3 ventas", "Primer lanzamiento de historias", "Sistema de setting funcionando". Con semana (1 a 12).
- tareas: entre 15 y 28 tareas accionables, título con verbo y menos de 90 caracteres, con semana, owner ("cliente" lo hace el cliente; "fractal" lo hace el equipo), por_que (una frase de negocio), area y prioridad. No repitas las tareas genéricas del recorrido (ver clases, completar secciones, revisar con Mateo/Lore).
- resumen_md: documento para el cliente, en español natural y de vos, con: "## Dónde estás hoy" (diagnóstico corto basado en sus datos), "## Tu norte a 90 días" (objetivo y métricas), "## Las fases" (una por bloque de semanas, qué se logra en cada una y por qué en ese orden), "## Lo que no vamos a hacer todavía" y "## Cómo medimos el avance". Conciso y específico para su negocio, sin relleno.
- No inventes datos: si algo del Segundo cerebro está vacío, proponé una tarea para definirlo.
- Respondé únicamente llamando a la herramienta guardar_roadmap.`;

/** Genera el roadmap personalizado (hitos + tareas + documento) para un cliente de consultoría. */
export async function generateRoadmap(orgId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = supabaseAdmin();
  const setStatus = (roadmap_status: string, extra: Record<string, unknown> = {}) =>
    sb.from('client_brain').update({ roadmap_status, ...extra }).eq('org_id', orgId);
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('Falta ANTHROPIC_API_KEY en Vercel');
    const [{ data: org }, { data: brain }] = await Promise.all([
      sb.from('organizations').select('id, name, start_date, responsables').eq('id', orgId).single(),
      sb.from('client_brain').select('data').eq('org_id', orgId).single(),
    ]);
    if (!org || !brain) throw new Error('No encontré el cliente o su Segundo cerebro');
    const data = (brain.data ?? {}) as BrainData;
    await setStatus('generando', { roadmap_error: null });

    const std = await fractalStandard(orgId);
    let week = 1;
    const mods = MODULES.map((m) => { const s = `${m.n} ${m.title} (semanas ${week}–${week + m.weeks - 1}, lidera ${m.lead})`; week += m.weeks; return s; }).join('; ');
    const today = iso(new Date(Date.now() - 3 * 3600e3));
    const start = org.start_date && org.start_date > today ? org.start_date : today;

    const anthropic = new Anthropic({ apiKey: key });
    const msg = await anthropic.messages.stream({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 16000,
      system: SYSTEM.replace('{MODULOS}', mods),
      tools: [TOOL],
      tool_choice: { type: 'auto' },
      messages: [{
        role: 'user',
        content: `Cliente: ${org.name}\nInicio del roadmap: ${start} (semana 1)\n\n<segundo_cerebro>\n${brainMarkdown(data, org.name)}\n</segundo_cerebro>\n\n<roadmaps_de_otros_clientes>\n${std.roadmaps || '(sin datos)'}\n</roadmaps_de_otros_clientes>\n\n<estrategias_de_otros_clientes>\n${std.strategy || '(sin datos)'}\n</estrategias_de_otros_clientes>\n\n<boveda_fractal>\n${std.vault || '(sin datos)'}\n</boveda_fractal>`,
      }],
    }).finalMessage();
    const block = msg.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') throw new Error('La IA no devolvió el roadmap en el formato esperado');
    const plan = block.input as Plan;

    // Reemplaza un roadmap anterior (los hitos del recorrido por módulo quedan)
    await sb.from('milestones').delete().eq('org_id', orgId).eq('source', 'ia');
    await sb.from('action_items').delete().eq('org_id', orgId).eq('source', 'roadmap').eq('done', false);
    await sb.from('documents').delete().eq('org_id', orgId).eq('kind', 'estrategia').like('title', 'Tu roadmap personalizado%');

    const wk = (n: number, dayOfWeek = 4) => addDays(start, (Math.min(12, Math.max(1, Math.round(n || 1))) - 1) * 7 + dayOfWeek);
    if (plan.hitos?.length) {
      const { error } = await sb.from('milestones').insert(plan.hitos.slice(0, 12).map((h, i) => ({
        org_id: orgId, title: h.title.slice(0, 160), detail: h.detalle ?? null, due_date: wk(h.semana), kind: 'hito', source: 'ia', position: 100 + i,
      })));
      if (error) throw new Error(error.message);
    }

    const resps = (org.responsables ?? []) as { name: string; side: string; aliases?: string[] }[];
    const findResp = (n?: string) => n ? resps.find((r) => [r.name, ...(r.aliases ?? [])].some((x) => x.toLowerCase() === n.toLowerCase())) : undefined;
    const rows = (plan.tareas ?? []).slice(0, 30).map((t, i) => {
      const r = findResp(t.responsable);
      return {
        org_id: orgId, title: t.title.slice(0, 200), why: t.por_que ?? null, area: t.area ?? null, priority: t.prioridad ?? null,
        owner: (r?.side as 'cliente' | 'fractal') ?? t.owner ?? 'cliente', responsable: r?.name ?? null,
        due_date: wk(t.semana), position: 200 + i, source: 'roadmap', notion_dirty: true,
      };
    });
    if (rows.length) {
      const { data: created, error } = await sb.from('action_items').insert(rows).select('id');
      if (error) throw new Error(error.message);
      for (const c of created ?? []) await pushActionToNotion(sb, c.id).catch(() => false);
    }

    const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    await sb.from('documents').insert({
      org_id: orgId, kind: 'estrategia', visible_to_client: true,
      title: `Tu roadmap personalizado · ${fecha}`,
      body_md: plan.resumen_md,
    });

    await setStatus('listo', { roadmap_at: new Date().toISOString(), roadmap_error: null });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('No se pudo generar el roadmap', message);
    await setStatus('error', { roadmap_error: message.slice(0, 400) });
    return { ok: false, error: message };
  }
}

export { brainPct, BRAIN };
