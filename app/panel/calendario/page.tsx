import Link from 'next/link';
import { getCalls, getMilestones, listClients } from '@/lib/data';
import { getContentCalendar, keyDatesFor, type ContentItem, type KeyDate } from '@/lib/calendar';
import { CalendarView } from '@/components/CalendarView';

export const metadata = { title: 'Calendario' };

export default async function GlobalCalendar() {
  const clients = (await listClients()).filter((c) => c.status === 'activo' || c.status === 'onboarding');
  const results = await Promise.all(clients.map(async (c) => {
    const [cal, milestones, calls] = await Promise.all([getContentCalendar(c), getMilestones(c.id), getCalls(c.id)]);
    return { cal, keys: keyDatesFor(c, milestones, calls) };
  }));
  const items: ContentItem[] = results.flatMap((r) => r.cal.items);
  const keys: KeyDate[] = results.flatMap((r) => r.keys);
  const errors = results.filter((r) => r.cal.error).length;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendario</h1>
          <p>El contenido de todos los clientes, las fechas clave de cada roadmap y las llamadas.</p>
        </div>
        <Link href="/panel/objetivos?v=semana" className="btn">Plan semanal del equipo</Link>
      </div>
      {errors > 0 && <p className="small" style={{ color: 'var(--warn)', marginBottom: 12 }}>No se pudieron leer {errors} calendarios de Notion.</p>}
      <CalendarView items={items} keyDates={keys} showClient />
    </>
  );
}
