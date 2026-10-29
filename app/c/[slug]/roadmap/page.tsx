import { getMilestones, getOrgBySlug } from '@/lib/data';
import { computeRoadmap } from '@/lib/roadmap';
import { Roadmap } from '@/components/Roadmap';

export const metadata = { title: 'Roadmap' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const view = computeRoadmap(await getMilestones(org.id), org.start_date);
  return (
    <>
      <header className="hello" style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 38 }}>Tu roadmap</h1>
        <p>Las etapas de la estrategia y en qué punto estamos hoy. Avanza solo según las fechas que acordamos.</p>
      </header>
      <Roadmap view={view} />
    </>
  );
}
