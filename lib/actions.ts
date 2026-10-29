'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { APP_URL, DEMO } from './env';
import { supabaseServer } from './supabase/server';
import { supabaseAdmin } from './supabase/admin';
import { kindFromUrl, materializeCall } from './process';
import { requireStaff, requireViewer } from './data';
import { after } from 'next/server';
import { pushActionStatus, pushNewAction, syncAtlasFromNotion, syncOrgFromNotion, } from './sync';
import { NOTION_DB, createRow, hasNotion, isNotionId, updateRow } from './notion';
import type { Org } from './types';

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function refresh() {
  revalidatePath('/', 'layout');
}

// ---------- Cliente (portal) ----------

export async function toggleAction(id: string, done: boolean) {
  if (DEMO) return;
  await requireViewer();
  const sb = await supabaseServer();
  const { data, error } = await sb.from('action_items').update({ done }).eq('id', id).select('notion_id').single();
  if (error) throw new Error(error.message);
  // Se refleja también en la base de tareas del cliente en Notion
  after(() => pushActionStatus(data?.notion_id ?? null, done));
  refresh();
}

export async function signOut() {
  if (!DEMO) {
    const sb = await supabaseServer();
    await sb.auth.signOut();
  }
  redirect('/login');
}

// ---------- Panel Fractal ----------

export async function createClientAccount(form: FormData) {
  const name = str(form, 'name');
  if (!name || DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  const { data: agency } = await sb.from('organizations').select('id').eq('kind', 'agency').limit(1).single();
  let slug = slugify(name);
  const { data: clash } = await sb.from('organizations').select('id').eq('slug', slug).maybeSingle();
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const domains = (str(form, 'email_domains') ?? '').split(/[,\s]+/).filter(Boolean);
  const { error } = await sb.from('organizations').insert({
    parent_id: agency?.id, kind: 'client', name, slug,
    status: str(form, 'status') ?? 'onboarding',
    offer: str(form, 'offer'),
    contact_name: str(form, 'contact_name'),
    contact_email: str(form, 'contact_email')?.toLowerCase() ?? null,
    email_domains: domains,
    start_date: str(form, 'start_date'),
  });
  if (error) throw new Error(error.message);
  refresh();
  redirect(`/panel/clientes/${slug}`);
}

export async function updateClientAccount(form: FormData) {
  if (DEMO) return;
  await requireStaff();
  const id = str(form, 'id')!;
  const sb = await supabaseServer();
  const month = str(form, 'program_month');
  const { error } = await sb.from('organizations').update({
    name: str(form, 'name'),
    status: str(form, 'status'),
    offer: str(form, 'offer'),
    program_month: month ? Number(month) : null,
    start_date: str(form, 'start_date'),
    next_step: str(form, 'next_step'),
    contact_name: str(form, 'contact_name'),
    contact_email: str(form, 'contact_email')?.toLowerCase() ?? null,
    email_domains: (str(form, 'email_domains') ?? '').split(/[,\s]+/).filter(Boolean),
    drive_url: str(form, 'drive_url'),
    tracker_url: str(form, 'tracker_url'),
    program_url: str(form, 'program_url'),
    notion_url: str(form, 'notion_url'),
  }).eq('id', id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function addAction(form: FormData) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  const orgId = str(form, 'org_id');
  const { data: created, error } = await sb.from('action_items').insert({
    org_id: orgId,
    call_id: str(form, 'call_id'),
    parent_id: str(form, 'parent_id'),
    title: str(form, 'title'),
    why: str(form, 'why'),
    area: str(form, 'area'),
    priority: str(form, 'priority'),
    owner: str(form, 'owner') ?? 'cliente',
    due_date: str(form, 'due_date'),
    source: 'manual',
  }).select('id, title, why, area, priority, due_date, parent_id').single();
  if (error) throw new Error(error.message);
  if (created && !created.parent_id) {
    const { data: org } = await sb.from('organizations').select('notion_tasks_db').eq('id', orgId!).single();
    const notionId = await pushNewAction(org?.notion_tasks_db, created);
    if (notionId) await sb.from('action_items').update({ notion_id: notionId }).eq('id', created.id);
  }
  refresh();
}

export async function deleteAction(id: string) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  await sb.from('action_items').delete().eq('id', id);
  refresh();
}

export async function addResource(form: FormData) {
  if (DEMO) return;
  await requireStaff();
  const url = str(form, 'url');
  if (!url) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('resources').upsert({
    org_id: str(form, 'org_id'),
    title: str(form, 'title') ?? url,
    url,
    kind: str(form, 'kind') ?? kindFromUrl(url),
    description: str(form, 'description'),
  }, { onConflict: 'org_id,url' });
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteResource(id: string) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  await sb.from('resources').delete().eq('id', id);
  refresh();
}

export async function saveDoc(form: FormData) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  const id = str(form, 'id');
  const row = {
    org_id: str(form, 'org_id'),
    title: str(form, 'title') ?? 'Sin título',
    kind: str(form, 'kind') ?? 'nota',
    body_md: (form.get('body_md') as string) ?? '',
    visible_to_client: form.get('visible_to_client') === 'on',
    updated_at: new Date().toISOString(),
  };
  const q = id ? sb.from('documents').update(row).eq('id', id) : sb.from('documents').insert(row);
  const { error } = await q;
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteDoc(id: string) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  await sb.from('documents').delete().eq('id', id);
  refresh();
}

export async function addMilestone(form: FormData) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  const { error } = await sb.from('milestones').insert({
    org_id: str(form, 'org_id'),
    title: str(form, 'title'),
    detail: str(form, 'detail'),
    due_date: str(form, 'due_date'),
    kind: str(form, 'kind') ?? 'hito',
    status: str(form, 'status') ?? 'pendiente',
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function setMilestoneStatus(id: string, status: string) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  await sb.from('milestones').update({ status, auto_status: false }).eq('id', id);
  refresh();
}

export async function deleteMilestone(id: string) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  await sb.from('milestones').delete().eq('id', id);
  refresh();
}

// ---------- Llamadas ----------

/** Asigna una llamada de la bandeja a un cliente y genera accionables/resumen. Opcionalmente recuerda el dominio. */
export async function assignCall(form: FormData) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  const callId = str(form, 'call_id')!;
  const orgId = str(form, 'org_id');
  if (!orgId) return;
  await sb.from('calls').update({ org_id: orgId }).eq('id', callId);
  if (form.get('remember') === 'on') {
    const { data: call } = await sb.from('calls').select('invitee_emails').eq('id', callId).single();
    const { data: org } = await sb.from('organizations').select('email_domains').eq('id', orgId).single();
    const add = (call?.invitee_emails ?? []).map((e: string) => e.split('@')[1]).filter((d: string) => d && !/gmail|hotmail|outlook|yahoo|icloud/.test(d));
    const personal = (call?.invitee_emails ?? []).filter((e: string) => /gmail|hotmail|outlook|yahoo|icloud/.test(e));
    const next = Array.from(new Set([...(org?.email_domains ?? []), ...add, ...personal]));
    await sb.from('organizations').update({ email_domains: next }).eq('id', orgId);
  }
  await materializeCall(sb, callId);
  refresh();
}

export async function reprocessCall(callId: string) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  await materializeCall(sb, callId);
  refresh();
}

export async function deleteCall(callId: string) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  await sb.from('calls').delete().eq('id', callId);
  refresh();
}

/** Carga manual: pegar transcript (por si una llamada no pasó por Fathom). */
export async function addManualCall(form: FormData) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  const transcript = (form.get('transcript') as string) ?? '';
  const held = str(form, 'held_at');
  const { data, error } = await sb.from('calls').insert({
    org_id: str(form, 'org_id'),
    title: str(form, 'title') ?? 'Llamada 1:1',
    held_at: held ? new Date(held).toISOString() : new Date().toISOString(),
    source: 'manual',
    share_url: str(form, 'share_url'),
    transcript,
  }).select('id').single();
  if (error || !data) throw new Error(error?.message);
  await materializeCall(sb, data.id);
  refresh();
}

// ---------- Accesos ----------

export async function inviteClientUser(form: FormData) {
  if (DEMO) return;
  await requireStaff();
  const email = str(form, 'email')?.toLowerCase();
  const orgId = str(form, 'org_id');
  const role = str(form, 'role') ?? 'client';
  if (!email || !orgId) return;
  const admin = supabaseAdmin();
  let userId: string | undefined;
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${APP_URL}/auth/callback?next=/set-password`,
    data: { full_name: str(form, 'name') },
  });
  if (invited?.user) userId = invited.user.id;
  if (error) {
    // Ya existe: lo buscamos y solo sumamos el acceso
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) throw new Error(error.message);
  }
  await admin.from('memberships').upsert({ user_id: userId, org_id: orgId, role }, { onConflict: 'user_id,org_id' });
  refresh();
}

export async function updateMyName(form: FormData) {
  if (DEMO) return;
  const v = await requireViewer();
  const name = str(form, 'full_name');
  if (!name) return;
  const sb = await supabaseServer();
  await sb.from('profiles').upsert({ id: v.id, email: v.email, full_name: name });
  refresh();
}

// ---------- Integraciones ----------

export async function createConnection(form: FormData) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  await sb.from('fathom_connections').insert({ label: str(form, 'label') ?? 'Equipo' });
  refresh();
}

export async function saveConnectionSecret(form: FormData) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  await sb.from('fathom_connections').update({ webhook_secret: str(form, 'secret') }).eq('id', str(form, 'id')!);
  refresh();
}

export async function deleteConnection(id: string) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  await sb.from('fathom_connections').delete().eq('id', id);
  refresh();
}

export async function resetMilestoneAuto(id: string) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  await sb.from('milestones').update({ auto_status: true }).eq('id', id);
  refresh();
}

// ---------- Sincronización con Notion ----------

export async function syncClientNow(orgId: string) {
  if (DEMO) return;
  await requireStaff();
  const sb = supabaseAdmin();
  const { data: org } = await sb.from('organizations').select('*').eq('id', orgId).single();
  if (org) await syncOrgFromNotion(sb, org as Org);
  refresh();
}

export async function syncAtlasNow() {
  if (DEMO) return;
  await requireStaff();
  await syncAtlasFromNotion(supabaseAdmin());
  refresh();
}

// ---------- Laboratorio ----------

export async function addLabEntry(form: FormData) {
  if (DEMO) return;
  const v = await requireStaff();
  const sb = await supabaseServer();
  const row = {
    title: str(form, 'title')!,
    tipo: str(form, 'tipo') ?? 'Aprendizaje',
    area: str(form, 'area'),
    prioridad: str(form, 'prioridad'),
    cliente: str(form, 'cliente'),
    responsable: str(form, 'responsable') ?? v.name,
    fecha: str(form, 'fecha') ?? new Date().toISOString().slice(0, 10),
    fuente: str(form, 'fuente'),
    notas: str(form, 'notas'),
    estado: 'Capturado',
  };
  if (!row.title) return;
  const { data, error } = await sb.from('lab_entries').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  // Respaldo en el Atlas de Notion
  if (hasNotion() && data) {
    try {
      const notionId = await createRow(NOTION_DB.atlas, {
        Registro: row.title, Tipo: row.tipo, 'Área': row.area, Estado: row.estado, Prioridad: row.prioridad,
        Cliente: row.cliente, Responsable: row.responsable, Fecha: row.fecha, Fuente: row.fuente, Notas: row.notas,
      });
      await sb.from('lab_entries').update({ notion_id: notionId }).eq('id', data.id);
    } catch (e) {
      console.error('No se pudo guardar en el Atlas de Notion', e);
    }
  }
  refresh();
}

export async function setLabEstado(id: string, estado: string) {
  if (DEMO) return;
  await requireStaff();
  const sb = await supabaseServer();
  const { data } = await sb.from('lab_entries').update({ estado, updated_at: new Date().toISOString() }).eq('id', id).select('notion_id').single();
  if (isNotionId(data?.notion_id)) after(() => updateRow(data!.notion_id!, { Estado: estado }).catch(() => undefined));
  refresh();
}

// ---------- Objetivos (se editan directo en Notion) ----------

export async function updateGoalActual(form: FormData) {
  if (DEMO) return;
  await requireStaff();
  const id = str(form, 'id');
  const actual = str(form, 'actual');
  if (!isNotionId(id) || actual === null) return;
  const estado = str(form, 'estado');
  await updateRow(id, { Actual: Number(actual.replace(/[^0-9.,-]/g, '').replace(',', '.')), ...(estado ? { Estado: estado } : {}) });
  revalidateTag('goals');
  revalidatePath('/panel/objetivos');
}

export async function setRewardEstado(id: string, estado: string) {
  if (DEMO) return;
  await requireStaff();
  if (!isNotionId(id)) return;
  await updateRow(id, { Estado: estado });
  revalidateTag('goals');
  revalidatePath('/panel/objetivos');
}
