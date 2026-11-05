import { getOrgBySlug, requireStaff } from '@/lib/data';
import { ContentLabPage } from '@/components/ContentLabPage';

export const metadata = { title: 'Laboratorio de contenido' };
export const dynamic = 'force-dynamic';

export default async function PanelContent({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ig?: string; msg?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams, requireStaff()]);
  const org = await getOrgBySlug(slug);
  return <ContentLabPage org={org} base={`/panel/clientes/${org.slug}`} staff ig={sp.ig} msg={sp.msg} />;
}
