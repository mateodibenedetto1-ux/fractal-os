import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/data';
import { authorizeUrl, igReady, signState } from '@/lib/instagram';
import { APP_URL } from '@/lib/env';

export const runtime = 'nodejs';

/** Arranca el login de Instagram para un cliente. ?org=<id>&back=<ruta> */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const org = url.searchParams.get('org') ?? '';
  const back = (url.searchParams.get('back') ?? '/').startsWith('/') ? url.searchParams.get('back')! : '/';
  const v = await getViewer();
  if (!v) return NextResponse.redirect(`${APP_URL}/login`);
  if (!v.isStaff && !v.clientOrgIds.includes(org)) return NextResponse.json({ error: 'Sin acceso a este cliente' }, { status: 403 });
  if (!igReady()) return NextResponse.redirect(`${APP_URL}${back}?ig=config`);
  return NextResponse.redirect(authorizeUrl(signState(org, v.id, back)));
}
