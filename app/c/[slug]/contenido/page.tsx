import { getOrgBySlug, requireViewer } from '@/lib/data';
import { ContentLabPage } from '@/components/ContentLabPage';

export const metadata = { title: 'Laboratorio de contenido' };
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export default async function PortalContent({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ig?: string; msg?: string; cuenta?: string; n?: string }> }) {
  const [{ slug }, sp, v] = await Promise.all([params, searchParams, requireViewer()]);
  const org = await getOrgBySlug(slug);
  return <ContentLabPage org={org} base={`/c/${org.slug}`} staff={v.isStaff} ig={sp.ig} msg={sp.msg} cuenta={sp.cuenta} n={sp.n} />;
}
