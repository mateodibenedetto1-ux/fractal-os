import { getCalls, getOrgBySlug, getResources } from '@/lib/data';
import { Resources } from '@/components/Resources';

export const metadata = { title: 'Recursos' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const [items, calls] = await Promise.all([getResources(org.id), getCalls(org.id)]);
  return (
    <>
      <header className="hello" style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 38 }}>Recursos y SOPs</h1>
        <p>Los documentos, hojas de cálculo, videos y carpetas que te compartimos en tus llamadas.</p>
      </header>
      <Resources items={items} calls={calls} />
    </>
  );
}
