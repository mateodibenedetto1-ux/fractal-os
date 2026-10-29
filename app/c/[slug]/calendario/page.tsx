import { getCalls, getMilestones, getOrgBySlug } from '@/lib/data';
import { getContentCalendar, keyDatesFor } from '@/lib/calendar';
import { CalendarView } from '@/components/CalendarView';

export const metadata = { title: 'Calendario' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const [cal, milestones, calls] = await Promise.all([getContentCalendar(org), getMilestones(org.id), getCalls(org.id)]);
  return (
    <>
      <header className="hello" style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 38 }}>Calendario</h1>
        <p>Tu contenido programado y en qué etapa está cada pieza, junto con las fechas clave de la estrategia.</p>
      </header>
      <CalendarView items={cal.items} keyDates={keyDatesFor(org, milestones, calls)} error={cal.error ? 'El calendario no está disponible en este momento.' : undefined} />
    </>
  );
}
