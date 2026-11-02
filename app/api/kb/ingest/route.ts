import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// La carga se hace desde una pestaña de Google Docs/Drive del equipo: el texto va directo del documento a la base.
const ORIGINS = ['https://docs.google.com', 'https://drive.google.com'];
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-ingest-token',
});

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) });
}

export async function POST(req: Request) {
  const headers = cors(req.headers.get('origin'));
  const token = req.headers.get('x-ingest-token') ?? '';
  const sb = supabaseAdmin();
  const hash = createHash('sha256').update(token).digest('hex');
  const { data: ok } = await sb.from('ingest_tokens').select('token_hash').eq('token_hash', hash).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!token || !ok) return NextResponse.json({ error: 'no autorizado' }, { status: 401, headers });

  const b = await req.json().catch(() => null);
  if (!b?.source_id || !b?.title) return NextResponse.json({ error: 'faltan datos' }, { status: 400, headers });
  const content = typeof b.content === 'string' ? b.content.replace(/\u0000/g, '').slice(0, 1_500_000) : null;
  const status = b.status ?? (content && content.trim().length > 40 ? 'ok' : 'sin_texto');
  const { error } = await sb.from('kb_documents').upsert({
    source_id: String(b.source_id), title: String(b.title).slice(0, 300), category: b.category ?? null, module: b.module ?? null,
    source_url: b.source_url ?? null, kind: b.kind ?? null, content, status, note: b.note ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: 'source_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
  return NextResponse.json({ ok: true, chars: content?.length ?? 0, status }, { headers });
}
