import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NOTION_DB, createRow, hasNotion, isNotionId, pageTitle, plainId, prop, queryDatabase, updateRow, val } from './notion';
import type { Org } from './types';

const PRIORITY_IN: Record<string, string> = { crítica: 'critica', critica: 'critica', alta: 'alta', media: 'media', baja: 'baja' };
export const PRIORITY_OUT: Record<string, string> = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };
const isDone = (s: unknown) => typeof s === 'string' && /done|ready|listo|complet|hecho/i.test(s);

/** "Entregable: ..." de las notas de Notion, o la primera frase. */
function whyFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const ent = notes.match(/Entregable:\s*([^\n]+)/i)?.[1];
  const text = (ent ?? notes.split('\n').find((l) => l.trim() && !/^registro anterior|^actualización/i.test(l.trim())) ?? '').trim();
  return text ? text.slice(0, 280) : null;
}

function ownerFromTitle(title: string): 'fractal' | 'cliente' {
  return /^(fractal|mateo|lore|equipo fractal)\b/i.test(title.trim()) ? 'fractal' : 'cliente';
}

export interface SyncResult {
  org: string;
  tasks: number;
  created: number;
  milestones: number;
  calls: number;
  error?: string;
}

/** Trae de Notion las tareas y el roadmap de un cliente y los actualiza en la app. */
export async function syncOrgFromNotion(sb: SupabaseClient, org: Org): Promise<SyncResult> {
  const res: SyncResult = { org: org.name, tasks: 0, created: 0, milestones: 0, calls: 0 };
  if (!hasNotion()) return { ...res, error: 'Falta NOTION_TOKEN' };
  try {
    // Roadmap primero, para poder vincular tareas a llamadas
    if (org.notion_roadmap_db) {
      const rows = await queryDatabase(org.notion_roadmap_db);
      let pos = 0;
      for (const r of rows) {
        const id = plainId(r.id);
        const title = pageTitle(r);
        const type = String(val(prop(r, 'Type', 'Tipo')) ?? '');
        const date = val(prop(r, 'Date', 'Fecha'));
        if (/llamada/i.test(type)) {
          const { data: existing } = await sb.from('calls').select('id').eq('notion_id', id).maybeSingle();
          const row = { org_id: org.id, title, share_url: val(prop(r, 'Link llamada')), ...(date ? { held_at: `${date.slice(0, 10)}T15:00:00Z` } : {}) };
          if (existing) await sb.from('calls').update(row).eq('id', existing.id);
          else await sb.from('calls').insert({ ...row, held_at: row.held_at ?? r.created_time, source: 'notion', status: 'procesada', notion_id: id });
          res.calls++;
        } else {
          const row = { org_id: org.id, title, due_date: date ? String(date).slice(0, 10) : null, kind: /^fase\b/i.test(title) ? 'fase' : 'hito' };
          const { data: existing } = await sb.from('milestones').select('id').eq('notion_id', id).maybeSingle();
          if (existing) await sb.from('milestones').update(row).eq('id', existing.id);
          else await sb.from('milestones').insert({ ...row, position: pos, notion_id: id });
          pos++;
          res.milestones++;
        }
      }
    }

    if (org.notion_tasks_db) {
      const rows = await queryDatabase(org.notion_tasks_db);
      const { data: calls } = await sb.from('calls').select('id, notion_id').eq('org_id', org.id).not('notion_id', 'is', null);
      const callByNotion = new Map((calls ?? []).map((c) => [plainId(c.notion_id!), c.id]));
      const { data: existing } = await sb.from('action_items').select('id, notion_id, done, why').eq('org_id', org.id).not('notion_id', 'is', null);
      const byNotion = new Map((existing ?? []).map((a) => [plainId(a.notion_id!), a]));
      const { count } = await sb.from('action_items').select('id', { count: 'exact', head: true }).eq('org_id', org.id);
      let pos = count ?? 0;

      for (const r of rows) {
        const id = plainId(r.id);
        const title = pageTitle(r);
        const done = isDone(val(prop(r, 'Estado', 'Status')));
        const relation: string[] = val(prop(r, 'Roadmap Phase', 'Roadmap', 'Llamada')) ?? [];
        const callId = relation.map((x) => callByNotion.get(x)).find(Boolean) ?? null;
        const fields = {
          title,
          done,
          priority: PRIORITY_IN[String(val(prop(r, 'Prioridad', 'Priority')) ?? '').toLowerCase()] ?? null,
          area: val(prop(r, 'Area', 'Área')),
          due_date: val(prop(r, 'Fecha Limite', 'Fecha límite', 'Due'))?.slice(0, 10) ?? null,
        };
        const cur = byNotion.get(id);
        if (cur) {
          await sb.from('action_items').update({
            ...fields,
            ...(callId ? { call_id: callId } : {}),
            ...(cur.done !== done ? { done_at: done ? new Date().toISOString() : null } : {}),
          }).eq('id', cur.id);
        } else {
          await sb.from('action_items').insert({
            ...fields,
            org_id: org.id,
            call_id: callId,
            why: whyFromNotes(val(prop(r, 'Notes & Links', 'Notas'))),
            owner: ownerFromTitle(title),
            done_at: done ? new Date().toISOString() : null,
            position: pos++,
            source: 'notion',
            notion_id: id,
          });
          res.created++;
        }
        res.tasks++;
      }
    }
    await sb.from('organizations').update({ last_synced_at: new Date().toISOString() }).eq('id', org.id);
  } catch (e) {
    res.error = e instanceof Error ? e.message : String(e);
  }
  return res;
}

/** Atlas de Notion → tabla lab_entries. */
export async function syncAtlasFromNotion(sb: SupabaseClient): Promise<{ count: number; error?: string }> {
  if (!hasNotion()) return { count: 0, error: 'Falta NOTION_TOKEN' };
  try {
    const rows = await queryDatabase(NOTION_DB.atlas);
    for (const r of rows) {
      await sb.from('lab_entries').upsert({
        notion_id: plainId(r.id),
        title: pageTitle(r),
        tipo: val(prop(r, 'Tipo')),
        area: val(prop(r, 'Área', 'Area')),
        estado: val(prop(r, 'Estado')) ?? 'Capturado',
        prioridad: val(prop(r, 'Prioridad')),
        cliente: val(prop(r, 'Cliente')),
        responsable: val(prop(r, 'Responsable')),
        fecha: val(prop(r, 'Fecha'))?.slice(0, 10) ?? null,
        fuente: val(prop(r, 'Fuente')),
        notas: val(prop(r, 'Notas')),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'notion_id' });
    }
    return { count: rows.length };
  } catch (e) {
    return { count: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- App → Notion ----------

export async function pushActionStatus(notionId: string | null, done: boolean) {
  if (!hasNotion() || !isNotionId(notionId)) return;
  try {
    await updateRow(notionId, { Estado: done ? 'Done' : 'Not started', Status: done ? 'Done' : 'Not started' });
  } catch (e) {
    console.error('No se pudo actualizar la tarea en Notion', e);
  }
}

export async function pushNewAction(dbId: string | null | undefined, a: { title: string; why?: string | null; area?: string | null; priority?: string | null; due_date?: string | null }) {
  if (!hasNotion() || !dbId) return null;
  try {
    return await createRow(dbId, {
      'Task name': a.title,
      Name: a.title,
      Estado: 'Not started',
      Area: a.area,
      Prioridad: a.priority ? PRIORITY_OUT[a.priority] : null,
      'Fecha Limite': a.due_date,
      'Notes & Links': a.why,
    });
  } catch (e) {
    console.error('No se pudo crear la tarea en Notion', e);
    return null;
  }
}
