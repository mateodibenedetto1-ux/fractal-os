import 'server-only';
import { cache } from 'react';
import { redirect, notFound } from 'next/navigation';
import { DEMO } from './env';
import { supabaseServer } from './supabase/server';
import * as demo from './demo';
import { NOTION_MARKER, notionPageMarkdown } from './notion';
import { supabaseAdmin } from './supabase/admin';
import { SUPABASE_SERVICE } from './env';
import type { ActionItem, Call, ClientSummary, Doc, FathomConnection, Milestone, Org, Resource, Viewer } from './types';

/** Usuario actual. En modo demo es un usuario staff ficticio. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (DEMO) return { id: 'demo', email: 'demo@fractal', name: 'Mateo', isStaff: true, clientOrgIds: [] };
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data: rows } = await sb
    .from('memberships')
    .select('role, org_id, organizations(kind)')
    .eq('user_id', auth.user.id);
  const list = (rows ?? []) as unknown as { role: string; org_id: string; organizations: { kind: string } | null }[];
  const isStaff = list.some((m) => m.organizations?.kind === 'agency' && m.role !== 'client');
  const { data: profile } = await sb.from('profiles').select('full_name').eq('id', auth.user.id).maybeSingle();
  return {
    id: auth.user.id,
    email: auth.user.email ?? '',
    name: profile?.full_name || (auth.user.user_metadata?.full_name as string | undefined) || nameFromEmail(auth.user.email ?? ''),
    isStaff,
    clientOrgIds: list.filter((m) => m.organizations?.kind === 'client').map((m) => m.org_id),
  };
});

/** "mateo.dibenedetto1@gmail.com" → "Mateo" */
function nameFromEmail(email: string) {
  const first = email.split('@')[0].split(/[._-]/)[0].replace(/\d+/g, '');
  return first ? first[0].toUpperCase() + first.slice(1) : email;
}

export async function requireViewer() {
  const v = await getViewer();
  if (!v) redirect('/login');
  return v;
}

export async function requireStaff() {
  const v = await requireViewer();
  if (!v.isStaff) redirect('/');
  return v;
}

// ---------- Clientes ----------

export async function listClients(): Promise<ClientSummary[]> {
  if (DEMO) {
    return demo.demoOrgs.filter((o) => o.kind === 'client').map((o) => summarize(o, demo.demoActions, demo.demoCalls));
  }
  const sb = await supabaseServer();
  const [{ data: orgs }, { data: actions }, { data: calls }] = await Promise.all([
    sb.from('organizations').select('*').eq('kind', 'client').order('name'),
    sb.from('action_items').select('org_id, done, parent_id'),
    sb.from('calls').select('org_id, held_at').not('org_id', 'is', null),
  ]);
  return ((orgs ?? []) as Org[]).map((o) =>
    summarize(o, (actions ?? []) as ActionItem[], (calls ?? []) as Call[]),
  );
}

function summarize(o: Org, actions: Pick<ActionItem, 'org_id' | 'done' | 'parent_id'>[], calls: Pick<Call, 'org_id' | 'held_at'>[]): ClientSummary {
  const mine = actions.filter((a) => a.org_id === o.id && !a.parent_id);
  const last = calls.filter((c) => c.org_id === o.id).map((c) => c.held_at).sort().pop() ?? null;
  return { ...o, total: mine.length, pending: mine.filter((a) => !a.done).length, lastCallAt: last };
}

export async function getOrgBySlug(slug: string): Promise<Org> {
  if (DEMO) {
    const o = demo.demoOrgs.find((x) => x.slug === slug && x.kind === 'client');
    if (!o) notFound();
    return o;
  }
  const sb = await supabaseServer();
  const { data } = await sb.from('organizations').select('*').eq('slug', slug).eq('kind', 'client').maybeSingle();
  if (!data) notFound();
  return data as Org;
}

export async function getMyClientOrg(v: Viewer): Promise<Org | null> {
  if (!v.clientOrgIds.length) return null;
  const sb = await supabaseServer();
  const { data } = await sb.from('organizations').select('*').eq('id', v.clientOrgIds[0]).maybeSingle();
  return (data as Org) ?? null;
}

// ---------- Contenido de una subcuenta ----------

export async function getActions(orgId: string): Promise<ActionItem[]> {
  if (DEMO) return demo.demoActions.filter((a) => a.org_id === orgId);
  const sb = await supabaseServer();
  const { data } = await sb.from('action_items').select('*').eq('org_id', orgId).order('position').order('created_at');
  return (data ?? []) as ActionItem[];
}

export async function getAllOpenActions(): Promise<(ActionItem & { org: Pick<Org, 'name' | 'slug'> })[]> {
  if (DEMO) {
    return demo.demoActions
      .filter((a) => !a.done && !a.parent_id)
      .map((a) => ({ ...a, org: demo.demoOrgs.find((o) => o.id === a.org_id)! }));
  }
  const sb = await supabaseServer();
  const { data } = await sb
    .from('action_items')
    .select('*, org:organizations(name, slug)')
    .eq('done', false)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .limit(300);
  return (data ?? []) as (ActionItem & { org: Pick<Org, 'name' | 'slug'> })[];
}

export async function getCalls(orgId: string): Promise<Call[]> {
  if (DEMO) return demo.demoCalls.filter((c) => c.org_id === orgId).sort((a, b) => b.held_at.localeCompare(a.held_at));
  const sb = await supabaseServer();
  const { data } = await sb
    .from('calls')
    .select('id, org_id, title, held_at, source, recording_id, fathom_url, share_url, summary_md, invitee_emails, status, error, created_at')
    .eq('org_id', orgId)
    .order('held_at', { ascending: false });
  return (data ?? []) as Call[];
}

export async function getInbox(): Promise<Call[]> {
  if (DEMO) return demo.demoCalls.filter((c) => !c.org_id);
  const sb = await supabaseServer();
  const { data } = await sb
    .from('calls')
    .select('id, org_id, title, held_at, source, recording_id, fathom_url, share_url, summary_md, invitee_emails, status, error, created_at')
    .is('org_id', null)
    .order('held_at', { ascending: false });
  return (data ?? []) as Call[];
}

export async function getRecentCalls(limit = 8): Promise<(Call & { org: Pick<Org, 'name' | 'slug'> | null })[]> {
  if (DEMO) {
    return [...demo.demoCalls]
      .sort((a, b) => b.held_at.localeCompare(a.held_at))
      .slice(0, limit)
      .map((c) => ({ ...c, org: demo.demoOrgs.find((o) => o.id === c.org_id) ?? null }));
  }
  const sb = await supabaseServer();
  const { data } = await sb
    .from('calls')
    .select('id, org_id, title, held_at, source, fathom_url, share_url, status, invitee_emails, org:organizations(name, slug)')
    .order('held_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as (Call & { org: Pick<Org, 'name' | 'slug'> | null })[];
}

export async function getResources(orgId: string): Promise<Resource[]> {
  if (DEMO) return demo.demoResources.filter((r) => r.org_id === orgId);
  const sb = await supabaseServer();
  const { data } = await sb.from('resources').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  return (data ?? []) as Resource[];
}

export async function getDocs(orgId: string): Promise<Doc[]> {
  if (DEMO) return demo.demoDocs.filter((d) => d.org_id === orgId);
  const sb = await supabaseServer();
  const { data } = await sb.from('documents').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  return (data ?? []) as Doc[];
}

export async function getDoc(orgId: string, id: string): Promise<Doc> {
  if (DEMO) {
    const d = demo.demoDocs.find((x) => x.id === id && x.org_id === orgId);
    if (!d) notFound();
    return d;
  }
  const sb = await supabaseServer();
  const { data } = await sb.from('documents').select('*').eq('org_id', orgId).eq('id', id).maybeSingle();
  if (!data) notFound();
  const doc = data as Doc;
  // Documento importado de Notion: se trae su contenido la primera vez y queda guardado.
  if (doc.notion_id && doc.body_md.startsWith(NOTION_MARKER)) {
    const md = await notionPageMarkdown(doc.notion_id);
    const notionUrl = `https://www.notion.so/${doc.notion_id.replace(/-/g, '')}`;
    const extra = doc.body_md.slice(NOTION_MARKER.length).trim();
    if (md) {
      const body = extra ? `${extra}\n\n${md}` : md;
      if (SUPABASE_SERVICE) await supabaseAdmin().from('documents').update({ body_md: body, updated_at: new Date().toISOString() }).eq('id', doc.id);
      return { ...doc, body_md: body };
    }
    return { ...doc, body_md: `${extra ? extra + '\n\n' : ''}Este documento está en Notion. [Abrir en Notion](${notionUrl})` };
  }
  return doc;
}

export async function getMilestones(orgId: string): Promise<Milestone[]> {
  if (DEMO) return demo.demoMilestones.filter((m) => m.org_id === orgId);
  const sb = await supabaseServer();
  const { data } = await sb.from('milestones').select('*').eq('org_id', orgId).order('position').order('due_date');
  return (data ?? []) as Milestone[];
}

export async function getConnections(): Promise<FathomConnection[]> {
  if (DEMO) return demo.demoConnections;
  const sb = await supabaseServer();
  const { data } = await sb.from('fathom_connections').select('*').order('created_at');
  return (data ?? []) as FathomConnection[];
}

export async function getMembers(orgId: string): Promise<{ email: string; name: string; role: string }[]> {
  if (DEMO) return [];
  const sb = await supabaseServer();
  const { data } = await sb.from('memberships').select('role, user_id').eq('org_id', orgId);
  const ids = (data ?? []).map((m) => m.user_id);
  if (!ids.length) return [];
  const { data: profiles } = await sb.from('profiles').select('id, email, full_name').in('id', ids);
  return (data ?? []).map((m) => {
    const p = profiles?.find((x) => x.id === m.user_id);
    return { email: p?.email ?? '', name: p?.full_name ?? '', role: m.role };
  });
}

export async function getLabEntries(): Promise<import('./types').LabEntry[]> {
  if (DEMO) return [];
  const sb = await supabaseServer();
  const { data } = await sb.from('lab_entries').select('*').order('fecha', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  return (data ?? []) as import('./types').LabEntry[];
}

export async function getAllMilestones(): Promise<Milestone[]> {
  if (DEMO) return demo.demoMilestones;
  const sb = await supabaseServer();
  const { data } = await sb.from('milestones').select('*').order('due_date');
  return (data ?? []) as Milestone[];
}

export async function getLabPages(): Promise<import('./types').LabPage[]> {
  if (DEMO) return [];
  const sb = await supabaseServer();
  const { data } = await sb.from('lab_pages').select('*').order('position');
  return (data ?? []) as import('./types').LabPage[];
}
