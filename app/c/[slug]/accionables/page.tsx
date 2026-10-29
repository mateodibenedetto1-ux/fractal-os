import { getActions, getCalls, getOrgBySlug } from '@/lib/data';
import { DEMO } from '@/lib/env';
import { ActionList } from '@/components/ActionList';

export const metadata = { title: 'Accionables' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const [actions, calls] = await Promise.all([getActions(org.id), getCalls(org.id)]);
  return (
    <>
      <header className="hello" style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 38 }}>Próximos accionables</h1>
        <p>Lo que te quedó pendiente de tus llamadas, de la más reciente a la más antigua. Marcá lo que vayas completando y nosotros vemos tu avance.</p>
      </header>
      <ActionList items={actions} calls={calls} demo={DEMO} responsables={org.responsables ?? []} />
    </>
  );
}
