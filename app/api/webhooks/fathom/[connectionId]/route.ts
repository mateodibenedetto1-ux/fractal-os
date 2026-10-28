import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { externalEmails, verifyFathomSignature, type FathomMeeting } from '@/lib/fathom';
import { matchOrg, materializeCall } from '@/lib/process';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Destino del webhook de Fathom. Cada persona del equipo crea su propio webhook en Fathom
 * apuntando a /api/webhooks/fathom/<id de conexión> (lo da la sección Integraciones).
 */
export async function POST(req: Request, ctx: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await ctx.params;
  const raw = await req.text();
  const sb = supabaseAdmin();

  const { data: conn } = await sb.from('fathom_connections').select('*').eq('id', connectionId).maybeSingle();
  if (!conn) return NextResponse.json({ error: 'conexión desconocida' }, { status: 404 });
  if (conn.webhook_secret && !verifyFathomSignature(conn.webhook_secret, req.headers, raw)) {
    return NextResponse.json({ error: 'firma inválida' }, { status: 401 });
  }

  let m: FathomMeeting;
  try {
    m = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'json inválido' }, { status: 400 });
  }

  const emails = externalEmails(m);
  const { data: orgs } = await sb.from('organizations').select('id, email_domains, contact_email').eq('kind', 'client');
  const orgId = matchOrg(orgs ?? [], emails);

  const { data: call, error } = await sb.from('calls').upsert({
    org_id: orgId,
    title: m.meeting_title || m.title,
    held_at: m.recording_start_time || m.scheduled_start_time || m.created_at,
    source: 'fathom',
    recording_id: m.recording_id,
    fathom_url: m.url,
    share_url: m.share_url,
    summary_md: m.default_summary?.markdown_formatted ?? null,
    transcript: m.transcript ?? null,
    raw: { default_summary: m.default_summary, action_items: m.action_items, calendar_invitees: m.calendar_invitees, recorded_by: m.recorded_by },
    invitee_emails: emails,
    status: 'pendiente',
  }, { onConflict: 'recording_id' }).select('id').single();

  await sb.from('fathom_connections').update({ last_event_at: new Date().toISOString() }).eq('id', connectionId);
  if (error || !call) return NextResponse.json({ error: error?.message }, { status: 500 });

  // Respondemos rápido a Fathom y procesamos en segundo plano.
  if (orgId) after(() => materializeCall(sb, call.id).then(() => undefined));
  return NextResponse.json({ ok: true, call: call.id, assigned: Boolean(orgId) });
}
