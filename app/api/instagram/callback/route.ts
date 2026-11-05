import { NextResponse, after } from 'next/server';
import { getViewer } from '@/lib/data';
import { connectAccount, readState, syncInstagram } from '@/lib/instagram';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { APP_URL } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Vuelta del login de Instagram: guarda el token cifrado y hace la primera sincronización. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = readState(url.searchParams.get('state') ?? '');
  const back = state?.b ?? '/';
  const go = (q: string) => NextResponse.redirect(`${APP_URL}${back}${back.includes('?') ? '&' : '?'}${q}`);
  if (!state) return go('ig=error&msg=' + encodeURIComponent('El enlace venció. Probá conectar de nuevo.'));
  if (url.searchParams.get('error')) return go('ig=cancel');
  const v = await getViewer();
  if (!v || v.id !== state.u) return go('ig=error&msg=' + encodeURIComponent('Iniciá sesión con la misma cuenta y volvé a intentar.'));
  try {
    const sb = supabaseAdmin();
    await connectAccount(sb, state.o, v.id, url.searchParams.get('code') ?? '');
    after(() => syncInstagram(sb, state.o, { pages: 4 }));
    return go('ig=ok');
  } catch (e) {
    return go('ig=error&msg=' + encodeURIComponent(e instanceof Error ? e.message : 'No se pudo conectar'));
  }
}
