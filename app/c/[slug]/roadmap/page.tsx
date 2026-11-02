import { getMilestones, getOrgBySlug } from '@/lib/data';
import { computeRoadmap } from '@/lib/roadmap';
import { getJourneyView } from '@/lib/journey-view';
import { Roadmap } from '@/components/Roadmap';
import { JourneyRoadmap } from '@/components/JourneyRoadmap';

export const metadata = { title: 'Roadmap' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const journey = org.segment === 'consulting' ? await getJourneyView(org) : null;
  if (journey) {
    return (
      <>
        <header className="ai-head">
          <h1>Tu roadmap</h1>
          <p className="muted small">Tu recorrido etapa por etapa. Cada una se desbloquea en su fecha.</p>
        </header>
        <JourneyRoadmap view={journey} base={`/c/${org.slug}`} />
      </>
    );
  }
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
