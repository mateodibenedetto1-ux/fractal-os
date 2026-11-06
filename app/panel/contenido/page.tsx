import { notFound } from 'next/navigation';
import { getAgency, requireStaff } from '@/lib/data';
import { ContentLabPage } from '@/components/ContentLabPage';

export const metadata = { title: 'Contenido' };
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Laboratorio de contenido de la cuenta propia de Fractal. */
export default async function AgencyContent({ searchParams }: { searchParams: Promise<{ ig?: string; msg?: string }> }) {
  const [sp] = await Promise.all([searchParams, requireStaff()]);
  const agency = await getAgency();
  if (!agency) notFound();
  return <ContentLabPage org={agency} base="/panel" staff own ig={sp.ig} msg={sp.msg} />;
}
