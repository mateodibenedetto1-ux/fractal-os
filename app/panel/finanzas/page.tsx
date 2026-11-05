import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/data';
import { canSeeFinance, getFinance } from '@/lib/finance';
import { DEMO } from '@/lib/env';
import { FinanceDashboard } from '@/components/FinanceDashboard';

export const metadata = { title: 'Finanzas' };
export const dynamic = 'force-dynamic';

export default async function FinancePage() {
  const v = await requireStaff();
  if (DEMO || !canSeeFinance(v.email)) notFound();
  let data;
  try {
    data = await getFinance();
  } catch (e) {
    return <div className="panel panel-pad">No pude leer las finanzas: {e instanceof Error ? e.message : 'error desconocido'}.</div>;
  }
  if (!data.months.length) {
    return <div className="panel panel-pad">Todavía no hay movimientos cargados. Se cargan cada mes junto con la planilla.</div>;
  }
  return <FinanceDashboard data={data} />;
}
