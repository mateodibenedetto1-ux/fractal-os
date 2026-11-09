'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from './data';
import { supabaseAdmin } from './supabase/admin';
import { addDays, mondayOf, todayAR, type Light, type WorkflowStep } from './health';
import { pushActionToNotion } from './sync';

const refresh = () => { revalidatePath('/panel/semaforo'); revalidatePath('/panel', 'layout'); revalidatePath('/c', 'layout'); };
const LIGHTS: Light[] = ['verde', 'amarillo', 'rojo'];

/** Cambia el color del semáforo a mano y deja registro. color null = vuelve al automático. */
export async function setHealth(orgId: string, color: Light | null, note?: string) {
  const v = await requireStaff();
  if (color && !LIGHTS.includes(color)) throw new Error('Color inválido');
  const sb = supabaseAdmin();
  await sb.from('client_health').upsert({ org_id: orgId, color, note: note ?? null, updated_by: v.name, updated_at: new Date().toISOString() });
  await sb.from('client_health_log').insert({ org_id: orgId, color, note: note || (color ? `Semáforo en ${color}` : 'Semáforo vuelve a automático'), author: v.name });
  refresh();
}

export async function setImportance(orgId: string, importance: string | null) {
  const v = await requireStaff();
  await supabaseAdmin().from('client_health').upsert({ org_id: orgId, importance: importance || null, updated_by: v.name, updated_at: new Date().toISOString() });
  refresh();
}

/** Nota del día (trazabilidad): queda en el historial del cliente. */
export async function addHealthNote(form: FormData) {
  const v = await requireStaff();
  const orgId = String(form.get('org_id') ?? '');
  const note = String(form.get('note') ?? '').trim();
  if (!orgId || !note) return;
  const sb = supabaseAdmin();
  const { data: h } = await sb.from('client_health').select('color').eq('org_id', orgId).maybeSingle();
  await sb.from('client_health_log').insert({ org_id: orgId, color: h?.color ?? null, note, author: v.name });
  refresh();
}

export async function addKpi(form: FormData) {
  await requireStaff();
  const orgId = String(form.get('org_id') ?? '');
  const name = String(form.get('name') ?? '').trim();
  const target = Number(form.get('target') ?? 0);
  if (!orgId || !name) return;
  await supabaseAdmin().from('client_kpis').insert({ org_id: orgId, week: mondayOf(), name, target, daily: form.get('daily') === 'on', position: Date.now() % 100000 });
  refresh();
}

export async function setKpiActual(id: string, actual: number) {
  await requireStaff();
  await supabaseAdmin().from('client_kpis').update({ actual: Math.max(0, actual), updated_at: new Date().toISOString() }).eq('id', id);
  refresh();
}

export async function deleteKpi(id: string) {
  await requireStaff();
  await supabaseAdmin().from('client_kpis').delete().eq('id', id);
  refresh();
}

/** Copia los KPIs de la semana pasada (metas, sin los reales) a esta semana. */
export async function copyLastWeekKpis(orgId: string) {
  await requireStaff();
  const sb = supabaseAdmin();
  const week = mondayOf();
  const { data: prev } = await sb.from('client_kpis').select('name, target, daily, position').eq('org_id', orgId).eq('week', addDays(week, -7));
  const { data: now } = await sb.from('client_kpis').select('name').eq('org_id', orgId).eq('week', week);
  const have = new Set((now ?? []).map((k) => k.name));
  const rows = (prev ?? []).filter((k) => !have.has(k.name)).map((k) => ({ ...k, org_id: orgId, week, actual: 0 }));
  if (rows.length) await sb.from('client_kpis').insert(rows);
  refresh();
}

// ---------- Workflow del cliente ----------

export async function saveWorkflow(orgId: string, steps: WorkflowStep[]) {
  await requireStaff();
  const clean = steps
    .filter((s) => s.title?.trim() && s.dow >= 1 && s.dow <= 7)
    .map((s) => ({ dow: Math.round(s.dow), title: s.title.trim().slice(0, 140), side: s.side === 'cliente' ? 'cliente' : 'fractal', responsable: s.responsable?.trim() || null }))
    .sort((a, b) => a.dow - b.dow);
  const { error } = await supabaseAdmin().from('organizations').update({ workflow: clean }).eq('id', orgId);
  if (error) throw new Error(error.message);
  refresh();
}

/** Crea los accionables de esta semana a partir del workflow (no duplica los que ya existen). */
export async function createWeekFromWorkflow(orgId: string): Promise<{ created: number }> {
  await requireStaff();
  const sb = supabaseAdmin();
  const { data: org } = await sb.from('organizations').select('workflow, vertical').eq('id', orgId).single();
  const steps = (org?.workflow ?? []) as WorkflowStep[];
  const week = mondayOf(todayAR());
  const { data: existing } = await sb.from('action_items').select('title, due_date').eq('org_id', orgId).gte('due_date', week).lte('due_date', addDays(week, 6));
  const seen = new Set((existing ?? []).map((a) => `${a.title}|${a.due_date}`));
  let created = 0;
  for (const s of steps) {
    const due = addDays(week, s.dow - 1);
    if (seen.has(`${s.title}|${due}`)) continue;
    const { data } = await sb.from('action_items').insert({
      org_id: orgId, title: s.title, why: 'Workflow semanal del cliente', area: 'Contenido', priority: 'alta',
      owner: s.side, responsable: s.responsable ?? null, due_date: due, source: 'manual', notion_dirty: true, vertical: org?.vertical ?? null,
    }).select('id').single();
    if (data) { created++; await pushActionToNotion(sb, data.id); }
  }
  refresh();
  return { created };
}
