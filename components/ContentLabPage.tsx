import { after } from 'next/server';
import { getContentLab } from '@/lib/content-lab';
import { igReady, syncInstagram } from '@/lib/instagram';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { DEMO } from '@/lib/env';
import type { Org } from '@/lib/types';
import { ContentLabView } from './ContentLabView';

const MSG: Record<string, string> = {
  ok: 'Listo, Instagram quedó conectado. La primera lectura de métricas tarda un par de minutos.',
  cancel: 'Se canceló la conexión con Instagram.',
  config: 'La conexión con Instagram todavía no está habilitada. El equipo de Fractal la está configurando.',
};

/** Laboratorio de contenido de un cliente (portal y panel). El acceso ya lo validó el layout. */
export async function ContentLabPage({ org, base, staff, own, ig, msg, cuenta, n }: { org: Org; base: string; staff: boolean; own?: boolean; ig?: string; msg?: string; cuenta?: string; n?: string }) {
  if (DEMO) return <div className="panel panel-pad">No disponible en modo demo.</div>;
  const lab = await getContentLab(org.id, cuenta);
  // Si la última lectura tiene más de 3 horas, se actualiza en segundo plano
  const stale = lab.account && (!lab.account.last_sync_at || Date.now() - new Date(lab.account.last_sync_at).getTime() > 3 * 3600_000);
  if (stale && lab.account) { const id = lab.account.ig_user_id; after(() => syncInstagram(supabaseAdmin(), org.id, id)); }
  const notice = ig === 'error' ? msg || 'No se pudo conectar Instagram.' : ig === 'ok' && Number(n) > 1 ? `Listo, se conectaron ${n} cuentas de Instagram. La primera lectura de métricas tarda unos minutos por cuenta.` : ig ? MSG[ig] : undefined;
  return (
    <ContentLabView
      lab={lab}
      orgId={org.id}
      orgName={org.name}
      base={`${base}/contenido`}
      staff={staff}
      own={own}
      connectHref={`/api/instagram/connect?org=${org.id}&back=${encodeURIComponent(`${base}/contenido`)}`}
      ready={igReady()}
      notice={notice}
      noticeKind={ig === 'error' ? 'err' : 'ok'}
    />
  );
}
