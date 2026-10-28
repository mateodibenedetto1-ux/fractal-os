import { getDocs, getOrgBySlug } from '@/lib/data';
import { Library } from '@/components/Library';
import { DocEditor } from '@/components/DocEditor';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const docs = await getDocs(org.id);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <details className="panel panel-pad disclose">
        <summary className="row between"><b style={{ fontWeight: 600 }}>Nuevo documento</b><span className="btn sm">Abrir</span></summary>
        <div style={{ marginTop: 16 }}><DocEditor orgId={org.id} /></div>
      </details>
      <Library docs={docs} base={`/panel/clientes/${org.slug}/biblioteca`} />
    </div>
  );
}
