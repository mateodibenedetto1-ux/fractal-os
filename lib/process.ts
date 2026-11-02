import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { linksIn, transcriptToText, type FathomMeeting } from './fathom';
import type { Org, ResourceKind } from './types';
import { pushActionToNotion } from './sync';
import { NOTION_DB, createRow, hasNotion } from './notion';
import { teamLabel } from './team';

export interface Extraction {
  summary_md: string;
  actions: { title: string; why?: string; area?: string; priority?: 'critica' | 'alta' | 'media' | 'baja'; owner?: 'cliente' | 'fractal'; responsable?: string; due_date?: string; subtasks?: string[] }[];
  resources: { title: string; url: string }[];
  learnings?: { title: string; tipo: string; area?: string; notas?: string }[];
  /** Si Claude falló y se usaron los datos de Fathom, el motivo. */
  fallback?: string;
}

const TEAM_SYSTEM = `Sos el asistente operativo de Fractal, una agencia de contenido y consultora de crecimiento.
Recibís el transcript de una reunión INTERNA del equipo de Fractal (no hay cliente presente).
Tu trabajo es dejar al equipo con claridad sobre qué hacer y capturar lo que aprendimos para el Laboratorio.

Reglas:
- Escribí en español neutro y claro, sin muletillas.
- summary_md: Markdown con "## Temas", "## Decisiones", "## Accionables" (lista breve) y "## Aprendizajes". Conciso.
- actions: tareas concretas y verificables. Título con verbo, menos de 90 caracteres. owner siempre "fractal".
  Si una tarea es de un cliente puntual, empezá el título con el nombre del cliente y dos puntos (ej: "Val: subir reel").
  responsable: si te paso la lista de responsables posibles, elegí exactamente uno de esos nombres.
  due_date: AAAA-MM-DD solo si se acordó un plazo concreto; calculalo desde la fecha de la reunión.
  area: una de Marketing, Contenido, Comercial, Operaciones, Adquisición, Producto, Branding, Métricas, General.
- learnings: lo que vale la pena guardar en el Laboratorio del equipo (máximo 6, solo lo relevante, no repitas tareas).
  tipo: Falla (algo salió mal y tuvo costo), Aprendizaje (qué haríamos distinto), Feedback (lo que dijo alguien sin filtrar),
  Experimento (algo a probar con resultado a medir), Hipótesis (explicación a validar), Decisión (criterio acordado), SOP (proceso a estandarizar).
  title: una frase clara de menos de 100 caracteres. notas: contexto breve (qué pasó, por qué importa, cliente si aplica).
- resources: documentos o links compartidos con su URL. No inventes URLs.`;

const SYSTEM = `Sos el asistente operativo de Fractal, una consultora de crecimiento.
Recibís el transcript de una llamada 1 a 1 entre el equipo de Fractal y un cliente.
Tu trabajo es dejarle al cliente total claridad sobre qué hacer después de la llamada.

Reglas:
- Escribí en español neutro y claro, tuteando con "vos" de forma natural, sin muletillas.
- summary_md: documento en Markdown con estas secciones: "## Dónde estamos", "## Decisiones", "## Accionables" (lista breve), "## Ideas y contexto". Conciso, sin relleno.
- actions: solo tareas concretas y verificables que surgieron de la llamada. Cada título empieza con verbo y tiene menos de 90 caracteres.
  "why" explica en una frase por qué importa (el motivo de negocio), como lo diría el consultor.
  owner = "fractal" si la tarea es del equipo de Fractal, "cliente" si la hace el cliente.
  responsable: si te paso la lista de responsables posibles, elegí exactamente uno de esos nombres (la persona que se comprometió a hacerlo).
  due_date: fecha límite en formato AAAA-MM-DD solo si en la llamada se acordó un día o plazo concreto; calculala a partir de la fecha de la llamada.
  area: una de Marketing, Contenido, Comercial, Operaciones, Adquisición, Producto, Branding, Métricas, General.
  subtasks: pasos concretos solo si la tarea los necesita.
- resources: documentos, hojas, carpetas o videos que se compartieron o mencionaron con su URL. No inventes URLs: usá solo las que aparecen en el texto.`;

const TOOL: Anthropic.Tool = {
  name: 'guardar_llamada',
  description: 'Guarda el resumen, accionables y recursos de la llamada.',
  input_schema: {
    type: 'object',
    properties: {
      summary_md: { type: 'string' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            why: { type: 'string' },
            area: { type: 'string' },
            priority: { type: 'string', enum: ['critica', 'alta', 'media', 'baja'] },
            owner: { type: 'string', enum: ['cliente', 'fractal'] },
            responsable: { type: 'string' },
            due_date: { type: 'string', description: 'AAAA-MM-DD' },
            subtasks: { type: 'array', items: { type: 'string' } },
          },
          required: ['title'],
        },
      },
      learnings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            tipo: { type: 'string', enum: ['Falla', 'Aprendizaje', 'Feedback', 'Experimento', 'Hipótesis', 'Decisión', 'SOP'] },
            area: { type: 'string' },
            notas: { type: 'string' },
          },
          required: ['title', 'tipo'],
        },
      },
      resources: {
        type: 'array',
        items: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' } }, required: ['title', 'url'] },
      },
    },
    required: ['summary_md', 'actions', 'resources'],
  },
};

/** Usa Claude si hay API key; si no, cae a lo que manda Fathom. */
export async function extract(input: { title: string; clientName?: string; heldAt?: string; responsables?: string[]; transcript: string; team?: string; fathomSummary?: string | null; fathomActions?: FathomMeeting['action_items'] }): Promise<Extraction> {
  const key = process.env.ANTHROPIC_API_KEY;
  let fallback = !key ? 'Falta ANTHROPIC_API_KEY' : 'La llamada no tiene transcript';
  if (key && input.transcript.trim()) {
    try {
      return await extractWithClaude(key, input);
    } catch (e) {
      // Clave vencida o inválida, sin saldo, etc.: seguimos con lo que mandó Fathom en vez de perder la llamada.
      fallback = e instanceof Error ? e.message : String(e);
      console.error('Claude no pudo procesar la llamada, uso los datos de Fathom:', fallback);
    }
  }
  // Fallback sin IA: los action items de Fathom o, si no vienen, los "Próximos pasos" del resumen
  const fromFathom = (input.fathomActions ?? []).map((a) => ({ title: a.description, owner: 'cliente' as const }));
  return {
    summary_md: input.fathomSummary || '_Sin resumen disponible._',
    actions: fromFathom.length ? fromFathom : nextStepsFromSummary(input.fathomSummary ?? ''),
    resources: linksIn(input.transcript).map((url) => ({ title: titleFromUrl(url), url })),
    fallback: fallback.slice(0, 300),
  };
}

async function extractWithClaude(key: string, input: { title: string; clientName?: string; heldAt?: string; responsables?: string[]; transcript: string; team?: string }): Promise<Extraction> {
  {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 8000,
      system: input.team ? TEAM_SYSTEM : SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{
        role: 'user',
        content: `Llamada: ${input.title}\n${input.team ? `Reunión interna del equipo · ${input.team}` : `Cliente: ${input.clientName ?? 'sin asignar'}`}\nFecha de la llamada: ${input.heldAt?.slice(0, 10) ?? 'desconocida'}${input.responsables?.length ? `\nResponsables posibles: ${input.responsables.join(', ')}` : ''}\n\n<transcript>\n${input.transcript}\n</transcript>`,
      }],
    });
    const block = msg.content.find((b) => b.type === 'tool_use');
    if (block && block.type === 'tool_use') return block.input as Extraction;
    throw new Error('Claude no devolvió el formato esperado');
  }
}

/** Lee la sección "Próximos pasos" del resumen de Fathom: viñetas por persona con sus tareas. */
export function nextStepsFromSummary(md: string): Extraction['actions'] {
  const clean = (t: string) => t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').trim();
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^#+\s*(próximos pasos|next steps|action items)/i.test(l.trim()));
  if (start < 0) return [];
  const out: Extraction['actions'] = [];
  let who: string | undefined;
  for (const raw of lines.slice(start + 1)) {
    if (/^#+\s/.test(raw.trim())) break;
    const m = raw.match(/^(\s*)[-*]\s+(.*)$/);
    if (!m) continue;
    const text = clean(m[2]);
    if (!text) continue;
    if (m[1].length <= 2 && /:$/.test(text)) { who = text.replace(/:$/, '').trim(); continue; }
    out.push({ title: text.replace(/\.$/, '').slice(0, 140), responsable: who });
  }
  return out;
}

export function kindFromUrl(url: string): ResourceKind {
  if (url.includes('docs.google.com/document')) return 'doc';
  if (url.includes('docs.google.com/spreadsheets')) return 'sheet';
  if (url.includes('docs.google.com/presentation')) return 'slides';
  if (url.includes('drive.google.com/drive/folders')) return 'folder';
  if (/loom\.com|youtube\.com|youtu\.be|vimeo\.com|fathom\.video/.test(url)) return 'video';
  if (/notion\.(so|site)/.test(url)) return 'page';
  return 'link';
}

function titleFromUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/** Busca la subcuenta por email exacto o dominio de algún invitado externo. */
export function matchOrg(orgs: Pick<Org, 'id' | 'email_domains' | 'contact_email'>[], emails: string[]): string | null {
  const lower = emails.map((e) => e.toLowerCase());
  for (const o of orgs) {
    const keys = [...(o.email_domains ?? []), o.contact_email ?? ''].map((k) => k.toLowerCase().trim()).filter(Boolean);
    if (lower.some((e) => keys.some((k) => (k.includes('@') ? e === k : e.endsWith('@' + k.replace(/^@/, '')))))) return o.id;
  }
  return null;
}

/**
 * Convierte una llamada en accionables, documento de resumen y recursos de la subcuenta.
 * Se usa desde el webhook (org detectada) o al asignar una llamada de la bandeja.
 */
export async function materializeCall(sb: SupabaseClient, callId: string) {
  const { data: call } = await sb.from('calls').select('*').eq('id', callId).single();
  if (!call?.org_id) return { ok: false, reason: 'sin_cliente' as const };
  const { data: org } = await sb.from('organizations').select('name, kind, responsables').eq('id', call.org_id).single();
  const team = org?.kind === 'agency' ? teamLabel(call.team_kind) : undefined;
  const responsables = ((org?.responsables ?? []) as { name: string; side: 'cliente' | 'fractal'; aliases?: string[] }[]);
  const findResp = (name?: string) => {
    if (!name) return undefined;
    const n = name.toLowerCase();
    return responsables.find((r) => [r.name, ...(r.aliases ?? [])].some((x) => x.toLowerCase() === n || n.startsWith(x.toLowerCase() + ' ')));
  };

  const raw = (call.raw ?? {}) as Partial<FathomMeeting>;
  const transcript = typeof call.transcript === 'string' ? call.transcript : transcriptToText({ transcript: call.transcript });

  try {
    const ex = await extract({
      title: call.title,
      clientName: org?.name,
      heldAt: call.held_at,
      responsables: responsables.map((r) => r.name),
      transcript,
      team,
      fathomSummary: raw.default_summary?.markdown_formatted ?? call.summary_md,
      fathomActions: raw.action_items,
    });

    // Limpia lo generado antes por esta llamada (re-procesar no duplica)
    await sb.from('action_items').delete().eq('call_id', callId).in('source', ['fathom', 'ia']);
    await sb.from('documents').delete().eq('call_id', callId).eq('kind', 'resumen');

    const source = ex.fallback ? 'fathom' : 'ia';
    let pos = 0;
    const created: string[] = [];
    for (const a of ex.actions) {
      const resp = findResp(a.responsable);
      const due = /^\d{4}-\d{2}-\d{2}$/.test(a.due_date ?? '') ? a.due_date : null;
      const { data: parent } = await sb.from('action_items').insert({
        org_id: call.org_id, call_id: callId, title: a.title, why: a.why ?? null, area: a.area ?? null,
        priority: a.priority ?? null, owner: resp?.side ?? a.owner ?? 'cliente', responsable: resp?.name ?? null,
        due_date: due, position: pos++, source, notion_dirty: true,
      }).select('id').single();
      if (parent) created.push(parent.id);
      if (parent && a.subtasks?.length) {
        await sb.from('action_items').insert(a.subtasks.map((t, i) => ({
          org_id: call.org_id, call_id: callId, parent_id: parent.id, title: t, owner: a.owner ?? 'cliente', position: i, source,
        })));
      }
    }

    const date = new Date(call.held_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    await sb.from('documents').insert({
      org_id: call.org_id, call_id: callId, kind: 'resumen',
      title: `Resumen · ${call.title} · ${date}`,
      body_md: ex.summary_md + (call.share_url ? `\n\n---\n[Ver grabación](${call.share_url})` : ''),
    });

    const res = ex.resources.filter((r) => /^https?:\/\//.test(r.url) && !r.url.includes('fathom.video'));
    if (res.length) {
      await sb.from('resources').upsert(
        res.map((r) => ({ org_id: call.org_id, call_id: callId, title: r.title, url: r.url, kind: kindFromUrl(r.url) })),
        { onConflict: 'org_id,url', ignoreDuplicates: true },
      );
    }

    // Respaldo en la base de tareas del cliente en Notion
    for (const id of created) await pushActionToNotion(sb, id);

    // Reunión del equipo: lo aprendido va al Laboratorio (y al Atlas de Notion). No se duplica al regenerar.
    if (team && ex.learnings?.length) await saveTeamLearnings(sb, call, team, ex.learnings);

    await sb.from('calls').update({ status: 'procesada', summary_md: ex.summary_md, error: ex.fallback ? `Sin IA (se usó Fathom): ${ex.fallback}` : null }).eq('id', callId);
    return { ok: true as const, actions: ex.actions.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await sb.from('calls').update({ status: 'error', error: message }).eq('id', callId);
    return { ok: false as const, reason: message };
  }
}

const LAB_TIPOS = ['Falla', 'Aprendizaje', 'Feedback', 'Experimento', 'Hipótesis', 'Decisión', 'SOP'];

async function saveTeamLearnings(
  sb: SupabaseClient,
  call: { id: string; title: string; held_at: string; share_url: string | null },
  team: string,
  learnings: NonNullable<Extraction['learnings']>,
) {
  const { count } = await sb.from('lab_entries').select('id', { count: 'exact', head: true }).eq('call_id', call.id);
  if (count) return;
  const fecha = call.held_at.slice(0, 10);
  const rows = learnings.slice(0, 6).map((l) => ({
    title: l.title.slice(0, 200),
    tipo: LAB_TIPOS.includes(l.tipo) ? l.tipo : 'Aprendizaje',
    area: l.area ?? null,
    estado: 'Capturado',
    cliente: 'Equipo',
    fecha,
    fuente: `Reunión ${team}: ${call.title}`,
    notas: [l.notas, call.share_url ? `Grabación: ${call.share_url}` : null].filter(Boolean).join('\n'),
    call_id: call.id,
  }));
  const { data } = await sb.from('lab_entries').insert(rows).select('id, title, tipo, area, estado, cliente, fecha, fuente, notas');
  if (!hasNotion() || !data) return;
  for (const r of data) {
    try {
      const notionId = await createRow(NOTION_DB.atlas, {
        Registro: r.title, Tipo: r.tipo, 'Área': r.area, Estado: r.estado, Cliente: r.cliente, Fecha: r.fecha, Fuente: r.fuente, Notas: r.notas,
      });
      await sb.from('lab_entries').update({ notion_id: notionId }).eq('id', r.id);
    } catch (e) {
      console.error('No se pudo guardar en el Atlas de Notion', e);
    }
  }
}
