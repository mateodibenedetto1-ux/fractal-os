import { getVault } from '@/lib/vault';
import { VaultView } from '@/components/VaultView';
import { DEMO } from '@/lib/env';

export const metadata = { title: 'Bóveda' };
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export default async function Boveda() {
  if (DEMO) return <div className="panel panel-pad">No disponible en modo demo.</div>;
  const { reports, daily } = await getVault();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bóveda</h1>
          <p>Los reportes de Fractal en un solo lugar: weeklies, fulfillment, cierres de semana y reportes del día.</p>
        </div>
      </div>
      <VaultView reports={reports} daily={daily} />
    </>
  );
}
