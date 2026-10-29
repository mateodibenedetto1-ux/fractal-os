import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { linksIn, transcriptToText, type FathomMeeting } from './fathom';
import type { Org, ResourceKind } from './types';
import { pushActionToNotion } from './sync';

export interface Extraction {
  summary_md: string;
  actions: { title: string; why?: string; area?: string; priority?: 'critica' | 'alta' | 'media' | 'baja'; owner?: 'cliente' | 'fractal'; responsable?: string; due_date?: string; subtasks?: string[] }[];
  resources: { title: string; url: string }[];
}

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
      resources: {
        type: 'array',
        items: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' } }, required: ['title', 'url'] },
      },
    },
    required: ['summary_md', 'actions', 'resources'],
  },
};

/** Usa Claude si hay API key; si no, cae a lo que manda Fathom. */
export async function extract(input: { title: string; clientName?: string; heldAt?: string; responsables?: string[]; transcript: string; fathomSummary?: string | null; fathomActions?: FathomMeeting['action_items'] }): Promise<Extraction> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key && input.transcript.trim()) {
    try {
      return await extractWithClaude(key, input);
    } catch (e) {
      // Clave vencida o inválida, sin saldo, etc.: seguimos con lo que mandó Fathom en vez de perder la llamada.
      console.error('Claude no pudo procesar la llamada, uso los datos de Fathom:', e instanceof Error ? e.message : e);
    }
  }
  // Fallback sin IA
  return {
    summary_md: input.fathomSummary || '_Sin resumen disponible._',
    actions: (input.fathomActions ?? []).map((a) => ({ title: a.description, owner: 'cliente' as const })),
    resources: linksIn(input.transcript).map((url) => ({ title: titleFromUrl(url), url })),
  };
}

async function extractWithClaude(key: string, input: { title: string; clientName?: string; heldAt?: string; responsables?: string[]; transcript: string }): Promise<Extraction> {
  {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 8000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{
        role: 'user',
        content: `Llamada: ${input.title}\nCliente: ${input.clientName ?? 'sin asignar'}\nFecha de la llamada: ${input.heldAt?.slice(0, 10) ?? 'desconocida'}${input.responsables?.length ? `\nResponsables posibles: ${input.responsables.join(', ')}` : ''}\n\n<transcript>\n${input.transcript}\n</transcript>`,
      }],
    });
    const block = msg.content.find((b) => b.type === 'tool_use');
    if (block && block.type === 'tool_use') return block.input as Extraction;
    throw new Error('Claude no devolvió el formato esperado');
  }
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
  const { data: org } = await sb.from('organizations').select('name, responsables').eq('id', call.org_id).single();
  const responsables = ((org?.responsables ?? []) as { name: string; side: 'cliente' | 'fractal' }[]);

  const raw = (call.raw ?? {}) as Partial<FathomMeeting>;
  const transcript = typeof call.transcript === 'string' ? call.transcript : transcriptToText({ transcript: call.transcript });

  try {
    const ex = await extract({
      title: call.title,
      clientName: org?.name,
      heldAt: call.held_at,
      responsables: responsables.map((r) => r.name),
      transcript,
      fathomSummary: raw.default_summary?.markdown_formatted ?? call.summary_md,
      fathomActions: raw.action_items,
    });

    // Limpia lo generado antes por esta llamada (re-procesar no duplica)
    await sb.from('action_items').delete().eq('call_id', callId).in('source', ['fathom', 'ia']);
    await sb.from('documents').delete().eq('call_id', callId).eq('kind', 'resumen');

    const source = process.env.ANTHROPIC_API_KEY ? 'ia' : 'fathom';
    let pos = 0;
    const created: string[] = [];
    for (const a of ex.actions) {
      const resp = responsables.find((r) => r.name.toLowerCase() === (a.responsable ?? '').toLowerCase());
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

    await sb.from('calls').update({ status: 'procesada', summary_md: ex.summary_md, error: null }).eq('id', callId);
    return { ok: true as const, actions: ex.actions.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await sb.from('calls').update({ status: 'error', error: message }).eq('id', callId);
    return { ok: false as const, reason: message };
  }
}
