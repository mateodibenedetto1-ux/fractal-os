import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ROADMAP_THRESHOLD, brainPct, generateRoadmap } from '@/lib/roadmap-ai';
import type { BrainData } from '@/lib/brain';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function guard(orgId: string | null) {
  const v = await getViewer();
  if (!v || !orgId) return null;
  if (!v.isStaff && !v.clientOrgIds.includes(orgId)) return null;
  return v;
}

/** Estado del roadmap personalizado (para que la pantalla se actualice sola mientras se genera). */
export async function GET(req: Request) {
  const orgId = new URL(req.url).searchParams.get('org');
  if (!(await guard(orgId))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { data } = await supabaseAdmin().from('client_brain').select('roadmap_status, roadmap_at, roadmap_error').eq('org_id', orgId!).maybeSingle();
  return NextResponse.json(data ?? { roadmap_status: null });
}

/** Crea (o, el equipo, vuelve a crear) el roadmap personalizado. */
export async function POST(req: Request) {
  const { orgId } = (await req.json().catch(() => ({}))) as { orgId?: string };
  const v = await guard(orgId ?? null);
  if (!v) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sb = supabaseAdmin();
  const { data } = await sb.from('client_brain').select('data, roadmap_status').eq('org_id', orgId!).maybeSingle();
  if (!data) return NextResponse.json({ error: 'El Segundo cerebro está vacío' }, { status: 400 });
  if (!v.isStaff) {
    if (brainPct((data.data ?? {}) as BrainData) < ROADMAP_THRESHOLD) return NextResponse.json({ error: `Completá al menos el ${ROADMAP_THRESHOLD} % de tu Segundo cerebro` }, { status: 400 });
    if (data.roadmap_status === 'listo' || data.roadmap_status === 'generando') return NextResponse.json({ error: 'Tu roadmap ya está creado' }, { status: 400 });
  }
  if (data.roadmap_status === 'generando' && !v.isStaff) return NextResponse.json({ ok: true });
  const r = await generateRoadmap(orgId!);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
