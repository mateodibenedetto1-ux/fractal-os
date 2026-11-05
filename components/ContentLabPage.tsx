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
export async function ContentLabPage({ org, base, staff, ig, msg }: { org: Org; base: string; staff: boolean; ig?: string; msg?: string }) {
  if (DEMO) return <div className="panel panel-pad">No disponible en modo demo.</div>;
  const lab = await getContentLab(org.id);
  // Si la última lectura tiene más de 3 horas, se actualiza en segundo plano
  const stale = lab.account && (!lab.account.last_sync_at || Date.now() - new Date(lab.account.last_sync_at).getTime() > 3 * 3600_000);
  if (stale) after(() => syncInstagram(supabaseAdmin(), org.id));
  const notice = ig === 'error' ? msg || 'No se pudo conectar Instagram.' : ig ? MSG[ig] : undefined;
  return (
    <ContentLabView
      lab={lab}
      orgId={org.id}
      orgName={org.name}
      staff={staff}
      connectHref={`/api/instagram/connect?org=${org.id}&back=${encodeURIComponent(`${base}/contenido`)}`}
      ready={igReady()}
      notice={notice}
      noticeKind={ig === 'error' ? 'err' : 'ok'}
    />
  );
}
