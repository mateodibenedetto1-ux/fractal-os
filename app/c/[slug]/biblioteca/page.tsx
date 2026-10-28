import { getDocs, getOrgBySlug } from '@/lib/data';
import { Library } from '@/components/Library';

export const metadata = { title: 'Biblioteca' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const docs = (await getDocs(org.id)).filter((d) => d.visible_to_client);
  return (
    <>
      <header className="hello" style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 38 }}>Biblioteca</h1>
        <p>Los resúmenes de cada llamada y los documentos de estrategia que armamos para vos.</p>
      </header>
      <Library docs={docs} base={`/c/${org.slug}/biblioteca`} />
    </>
  );
}
