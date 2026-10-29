import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { syncAtlasFromNotion, syncOrgFromNotion } from '@/lib/sync';
import type { Org } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Sincronización diaria Notion → app (Vercel Cron, ver vercel.json).
 * Protegida con CRON_SECRET si está configurado; si no, solo acepta el cron de Vercel.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const fromVercel = (req.headers.get('user-agent') ?? '').startsWith('vercel-cron');
  if (secret ? auth !== `Bearer ${secret}` : !fromVercel) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const sb = supabaseAdmin();
  const { data: orgs } = await sb.from('organizations').select('*').eq('kind', 'client').in('status', ['activo', 'onboarding']);
  const clients = [];
  for (const o of (orgs ?? []) as Org[]) {
    if (o.notion_tasks_db || o.notion_roadmap_db) clients.push(await syncOrgFromNotion(sb, o));
  }
  const atlas = await syncAtlasFromNotion(sb);
  return NextResponse.json({ ok: true, clients, atlas });
}
