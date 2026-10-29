import { getCalls, getMilestones, getOrgBySlug } from '@/lib/data';
import { getContentCalendar, keyDatesFor } from '@/lib/calendar';
import { CalendarView } from '@/components/CalendarView';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await getOrgBySlug((await params).slug);
  const [cal, milestones, calls] = await Promise.all([getContentCalendar(org), getMilestones(org.id), getCalls(org.id)]);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <p className="muted small">Se edita en Notion y se actualiza acá cada cinco minutos. {org.notion_calendars?.length ? `Calendarios: ${org.notion_calendars.map((c) => c.label).join(', ')}.` : 'Este cliente no tiene calendario conectado.'}</p>
      <CalendarView items={cal.items} keyDates={keyDatesFor(org, milestones, calls)} error={cal.error} />
    </div>
  );
}
