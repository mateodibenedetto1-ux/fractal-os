import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './supabase/admin';
import { BRAIN, MODULES, brainMarkdown, brainPct, type BrainData } from './brain';
import { NOTION_MARKER, notionPageMarkdown } from './notion';
import { retrieve } from './ai';
import { pushActionToNotion } from './sync';
import { buildJourney, journeyStart, leadShort, stageWindows } from './journey';

/** Con este porcentaje del Segundo cerebro completo se crea el roadmap personalizado. */
export const ROADMAP_THRESHOLD = 80;

const DAY = 864e5;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(new Date(s + 'T12:00:00').getTime() + n * DAY));
const weeksBetween = (a: string, b: string) => Math.max(1, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / (7 * DAY)) + 1);

interface Plan {
  resumen_md: string;
  etapas: { modulo: string; objetivo: string; entregable?: string }[];
  hitos: { title: string; detalle?: string; modulo: string }[];
  tareas: { title: string; por_que?: string; owner?: 'cliente' | 'fractal'; responsable?: string; modulo: string; area?: string; prioridad?: 'critica' | 'alta' | 'media' | 'baja' }[];
}

const MOD_KEYS = MODULES.map((m) => m.k);

const TOOL: Anthropic.Tool = {
  name: 'guardar_roadmap',
  description: 'Guarda el roadmap personalizado del cliente, etapa por etapa.',
  input_schema: {
    type: 'object',
    properties: {
      resumen_md: { type: 'string', description: 'Documento en Markdown para el cliente.' },
      etapas: {
        type: 'array',
        description: 'Una por módulo, en orden.',
        items: { type: 'object', properties: { modulo: { type: 'string', enum: MOD_KEYS }, objetivo: { type: 'string' }, entregable: { type: 'string' } }, required: ['modulo', 'objetivo'] },
      },
      hitos: {
        type: 'array',
        items: { type: 'object', properties: { title: { type: 'string' }, detalle: { type: 'string' }, modulo: { type: 'string', enum: MOD_KEYS } }, required: ['title', 'modulo'] },
      },
      tareas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' }, por_que: { type: 'string' },
            owner: { type: 'string', enum: ['cliente', 'fractal'] }, responsable: { type: 'string' },
            modulo: { type: 'string', enum: MOD_KEYS },
            area: { type: 'string' }, prioridad: { type: 'string', enum: ['critica', 'alta', 'media', 'baja'] },
          },
          required: ['title', 'modulo'],
        },
      },
    },
    required: ['resumen_md', 'etapas', 'hitos', 'tareas'],
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
Tu trabajo es crear el roadmap personalizado de un cliente que completó su Segundo cerebro.

El roadmap sigue SIEMPRE las etapas del Recorrido Fractal, que son los módulos del curso y las secciones del Segundo cerebro, en este orden:
{ETAPAS}

Cómo hacerlo:
- Basate en TODO lo que escribió el cliente en cada sección de su Segundo cerebro (no solo en sus objetivos). Cada etapa trabaja sobre sus secciones: por ejemplo, en "ICP & Research" profundizás su punto de partida y su cliente de alto valor; en "Oferta", su oferta y escalera; y así.
- Usá como estándar cómo armamos los roadmaps, estrategias creativas y de marketing de los demás clientes de Fractal: el tipo de hitos, el ritmo y el orden se repiten. Replicá ese patrón y adaptalo a este negocio.
- etapas: una por cada módulo (las 9), con "objetivo" (1 o 2 frases, específicas para este negocio, de vos: qué va a lograr en esta etapa con lo que ya escribió) y "entregable" (lo concreto que queda hecho al terminarla).
- hitos: 1 por etapa (2 si la etapa es de 2 semanas y lo amerita). Logros verificables del negocio, no "ver clases". Ej: "Oferta líder validada en 5 conversaciones".
- tareas: 2 a 4 por etapa, accionables, título con verbo y menos de 90 caracteres, con owner ("cliente" o "fractal"), por_que (una frase de negocio), area y prioridad. No repitas las tareas que ya trae cada etapa: ver las clases, completar las secciones del Segundo cerebro y revisarlo con Mateo/Lore.
- Si algo del Segundo cerebro está vacío o flojo, la tarea de esa etapa es definirlo o mejorarlo.
- resumen_md: documento para el cliente, en español natural y de vos, con: "## Dónde estás hoy" (diagnóstico corto con sus datos), "## Tu norte a 90 días" (objetivo y métricas), "## Tu recorrido, etapa por etapa" (una línea por etapa con lo que logra), "## Lo que no vamos a hacer todavía" y "## Cómo medimos el avance". Conciso y específico.
- No inventes datos. Respondé únicamente llamando a la herramienta guardar_roadmap.`;

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

    // El roadmap se apoya en el Recorrido (etapas por módulo). Si no existe, se crea ahora.
    const { data: orgFull } = await sb.from('organizations').select('start_date, program_url').eq('id', orgId).single();
    const { start, exists } = await journeyStart(sb, orgId, orgFull?.start_date ?? null);
    if (!exists) await buildJourney(sb, orgId, start, orgFull?.program_url ?? null);
    const wins = stageWindows(start);
    const today = iso(new Date(Date.now() - 3 * 3600e3));

    const std = await fractalStandard(orgId);
    const etapas = wins.map((w) => {
      const secs = BRAIN.filter((b) => b.mod === w.k).map((b) => b.title).join(', ');
      return `${w.n} ${w.title} · semanas ${w.startWeek}–${w.endWeek} (${w.start} a ${w.end}) · lidera ${leadShort(w.lead)} · secciones del Segundo cerebro: ${secs}`;
    }).join('\n');

    const anthropic = new Anthropic({ apiKey: key });
    const msg = await anthropic.messages.stream({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 16000,
      system: SYSTEM.replace('{ETAPAS}', etapas),
      tools: [TOOL],
      tool_choice: { type: 'auto' },
      messages: [{
        role: 'user',
        content: `Cliente: ${org.name}\nHoy: ${today}\n\n<segundo_cerebro>\n${brainMarkdown(data, org.name)}\n</segundo_cerebro>\n\n<roadmaps_de_otros_clientes>\n${std.roadmaps || '(sin datos)'}\n</roadmaps_de_otros_clientes>\n\n<estrategias_de_otros_clientes>\n${std.strategy || '(sin datos)'}\n</estrategias_de_otros_clientes>\n\n<boveda_fractal>\n${std.vault || '(sin datos)'}\n</boveda_fractal>`,
      }],
    }).finalMessage();
    const block = msg.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') throw new Error('La IA no devolvió el roadmap en el formato esperado');
    const plan = block.input as Plan;

    // Reemplaza un roadmap anterior (las etapas y tareas base del recorrido quedan)
    await sb.from('milestones').delete().eq('org_id', orgId).eq('source', 'ia');
    await sb.from('action_items').delete().eq('org_id', orgId).eq('source', 'roadmap').eq('done', false);
    await sb.from('documents').delete().eq('org_id', orgId).eq('kind', 'estrategia').like('title', 'Tu roadmap personalizado%');

    const win = (k: string) => wins.find((w) => w.k === k) ?? wins[0];
    const notPast = (d: string) => (d < today ? today : d);

    // Objetivo personalizado de cada etapa
    for (const e of plan.etapas ?? []) {
      const m = MODULES.find((x) => x.k === e.modulo);
      if (!m) continue;
      const detail = `${e.objetivo}${e.entregable ? `\n\nEntregable: ${e.entregable}` : ''}\n\nLo guía ${leadShort(m.lead)}.`;
      await sb.from('milestones').update({ detail }).eq('org_id', orgId).eq('kind', 'fase').eq('brain_section', m.k);
    }

    if (plan.hitos?.length) {
      const { error } = await sb.from('milestones').insert(plan.hitos.slice(0, 14).map((h, i) => ({
        org_id: orgId, title: h.title.slice(0, 160), detail: h.detalle ?? null, due_date: win(h.modulo).end, kind: 'hito', source: 'ia', module: win(h.modulo).k, position: 100 + i,
      })));
      if (error) throw new Error(error.message);
    }

    const resps = (org.responsables ?? []) as { name: string; side: string; aliases?: string[] }[];
    const findResp = (n?: string) => n ? resps.find((r) => [r.name, ...(r.aliases ?? [])].some((x) => x.toLowerCase() === n.toLowerCase())) : undefined;
    const perMod = new Map<string, number>();
    const rows = (plan.tareas ?? []).slice(0, 36).map((t, i) => {
      const r = findResp(t.responsable);
      const w = win(t.modulo);
      // Reparte las tareas de cada etapa entre su inicio y su fin
      const n = perMod.get(w.k) ?? 0;
      perMod.set(w.k, n + 1);
      const span = (new Date(w.end).getTime() - new Date(w.start).getTime()) / DAY;
      const due = addDays(w.start, Math.min(span, 2 + n * 2));
      return {
        org_id: orgId, title: t.title.slice(0, 200), why: t.por_que ?? null, area: t.area ?? null, priority: t.prioridad ?? null,
        owner: (r?.side as 'cliente' | 'fractal') ?? t.owner ?? 'cliente', responsable: r?.name ?? null,
        due_date: notPast(due), position: 200 + i, source: 'roadmap', module: w.k, notion_dirty: true,
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
