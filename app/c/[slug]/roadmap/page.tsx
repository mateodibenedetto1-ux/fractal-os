import { getMilestones, getOrgBySlug } from '@/lib/data';
import { Roadmap } from '@/components/Roadmap';

export const metadata = { title: 'Roadmap' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const items = await getMilestones(org.id);
  return (
    <>
      <header className="hello" style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 38 }}>Tu roadmap</h1>
        <p>Las etapas del programa y en qué punto estás.</p>
      </header>
      <Roadmap items={items} />
    </>
  );
}
