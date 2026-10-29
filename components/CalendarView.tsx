'use client';

import { useMemo, useState } from 'react';
import type { ContentItem, KeyDate } from '@/lib/calendar';

const GROUPS: { k: string; l: string; test: (i: ContentItem) => boolean }[] = [
  { k: 'todo', l: 'Todo', test: () => true },
  { k: 'reels', l: 'Reels', test: (i) => /reel|voiceover|breakdown|dump|reducci/i.test(i.formato ?? '') },
  { k: 'historias', l: 'Historias', test: (i) => /historia/i.test(i.formato ?? '') },
  { k: 'carruseles', l: 'Carruseles', test: (i) => /carrusel/i.test(i.formato ?? '') },
  { k: 'long', l: 'Long form', test: (i) => /longform|long form/i.test(i.formato ?? '') },
  { k: 'youtube', l: 'YouTube', test: (i) => /youtube/i.test(i.plataforma ?? '') },
];

/** Estado de producción en lenguaje del cliente. */
export function stage(estado: string | null): { label: string; tone: '' | 'ok' | 'warn' | 'brand' } {
  const e = (estado ?? '').toLowerCase();
  if (e.includes('publicado')) return { label: 'Publicado', tone: 'ok' };
  if (e.includes('aprobado')) return { label: 'Aprobado', tone: 'ok' };
  if (e.includes('revisi') || e.includes('corregir')) return { label: 'En revisión', tone: 'warn' };
  if (e.includes('edici') || e.includes('diseño')) return { label: 'En edición', tone: 'brand' };
  if (e.includes('material')) return { label: 'Material listo', tone: '' };
  if (e.includes('grabar')) return { label: 'Para grabar', tone: '' };
  if (e.includes('guion')) return { label: 'En guion', tone: '' };
  return { label: estado ?? 'Sin estado', tone: '' };
}

const FORMAT_TONE = (i: ContentItem) =>
  /historia/i.test(i.formato ?? '') ? 'var(--warn)' : /carrusel/i.test(i.formato ?? '') ? 'var(--focus)' : /long|youtube/i.test(`${i.formato} ${i.plataforma}`) ? '#8a6bb8' : 'var(--brand)';

const KEY_LABEL = { fase: 'Inicio de fase', hito: 'Hito', llamada: 'Llamada' } as const;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthName = (d: Date) => { const s = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };
const dayLabel = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

interface Props {
  items: ContentItem[];
  keyDates: KeyDate[];
  showClient?: boolean;
  error?: string;
  emptyText?: string;
}

export function CalendarView({ items, keyDates, showClient, error, emptyText }: Props) {
  const today = iso(new Date());
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [view, setView] = useState<'mes' | 'lista'>('mes');
  const [group, setGroup] = useState('todo');
  const [cuenta, setCuenta] = useState('Todas');
  const [client, setClient] = useState('Todos');
  const [selected, setSelected] = useState<string | null>(today);
  const [showKeys, setShowKeys] = useState(true);

  const cuentas = useMemo(() => Array.from(new Set(items.map((i) => i.cuenta))).sort(), [items]);
  const clients = useMemo(() => Array.from(new Set([...items.map((i) => i.client), ...keyDates.map((k) => k.client)].filter(Boolean))) as string[], [items, keyDates]);
  const g = GROUPS.find((x) => x.k === group)!;
  const filtered = items.filter((i) => g.test(i) && (cuenta === 'Todas' || i.cuenta === cuenta) && (client === 'Todos' || i.client === client));
  const keys = showKeys ? keyDates.filter((k) => client === 'Todos' || k.client === client) : [];

  const byDay = useMemo(() => {
    const m = new Map<string, { content: ContentItem[]; keys: KeyDate[] }>();
    const get = (d: string) => m.get(d) ?? (m.set(d, { content: [], keys: [] }), m.get(d)!);
    filtered.forEach((i) => get(i.date).content.push(i));
    keys.forEach((k) => get(k.date).keys.push(k));
    return m;
  }, [filtered, keys]);

  // Grilla del mes, semanas de lunes a domingo
  const first = new Date(cursor);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first); start.setDate(1 - offset);
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const weeks = days[35].getMonth() !== cursor.getMonth() ? 5 : 6;

  const move = (n: number) => setCursor((c) => { const d = new Date(c); d.setMonth(c.getMonth() + n); return d; });
  const upcoming = Array.from(byDay.entries()).filter(([d]) => d >= today).sort(([a], [b]) => a.localeCompare(b)).slice(0, 40);
  const sel = selected ? byDay.get(selected) : undefined;

  if (error) return <div className="panel empty">{error}</div>;
  if (!items.length && !keyDates.length) return <div className="panel empty">{emptyText ?? 'Todavía no hay contenidos en el calendario.'}</div>;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div className="chips" role="group" aria-label="Formato">
          {GROUPS.map((x) => {
            const n = items.filter(x.test).length;
            if (x.k !== 'todo' && !n) return null;
            return <button key={x.k} className={`chip ${group === x.k ? 'on' : ''}`} onClick={() => setGroup(x.k)}>{x.l} <span>{n}</span></button>;
          })}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className={`chip ${view === 'mes' ? 'on' : ''}`} onClick={() => setView('mes')}>Mes</button>
          <button className={`chip ${view === 'lista' ? 'on' : ''}`} onClick={() => setView('lista')}>Próximos</button>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 10 }}>
        {cuentas.length > 1 && (
          <select className="select" value={cuenta} onChange={(e) => setCuenta(e.target.value)} style={{ width: 200 }} aria-label="Cuenta">
            <option>Todas</option>{cuentas.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        {showClient && clients.length > 1 && (
          <select className="select" value={client} onChange={(e) => setClient(e.target.value)} style={{ width: 200 }} aria-label="Cliente">
            <option>Todos</option>{clients.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        <label className="row small muted" style={{ gap: 6 }}><input type="checkbox" checked={showKeys} onChange={(e) => setShowKeys(e.target.checked)} /> Fechas clave y llamadas</label>
      </div>

      {view === 'mes' ? (
        <div className="cal panel">
          <div className="cal-head">
            <button className="btn ghost sm" onClick={() => move(-1)} aria-label="Mes anterior">‹</button>
            <b>{monthName(cursor)}</b>
            <button className="btn ghost sm" onClick={() => move(1)} aria-label="Mes siguiente">›</button>
          </div>
          <div className="cal-grid" style={{ gridTemplateRows: `auto repeat(${weeks}, minmax(92px, auto))` }}>
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {days.slice(0, weeks * 7).map((d) => {
              const k = iso(d);
              const e = byDay.get(k);
              const out = d.getMonth() !== cursor.getMonth();
              const list = e?.content ?? [];
              return (
                <button key={k} className={`cal-day ${out ? 'out' : ''} ${k === today ? 'today' : ''} ${selected === k ? 'sel' : ''}`} onClick={() => setSelected(k)}>
                  <span className="cal-num">{d.getDate()}</span>
                  {e?.keys.map((kd) => <span key={kd.id} className={`cal-key k-${kd.kind}`}>{kd.title}</span>)}
                  {list.slice(0, 3).map((i) => (
                    <span key={i.id} className="cal-item"><i style={{ background: FORMAT_TONE(i) }} />{i.title}</span>
                  ))}
                  {list.length > 3 && <span className="cal-more">+{list.length - 3} más</span>}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === 'mes' && selected && (
        <DayDetail day={selected} entry={sel} showClient={showClient} />
      )}

      {view === 'lista' && (
        <div className="stack" style={{ gap: 12 }}>
          {upcoming.map(([d, e]) => <DayDetail key={d} day={d} entry={e} showClient={showClient} />)}
          {!upcoming.length && <div className="panel empty">No hay nada programado desde hoy.</div>}
        </div>
      )}
    </div>
  );
}

function DayDetail({ day, entry, showClient }: { day: string; entry?: { content: ContentItem[]; keys: KeyDate[] }; showClient?: boolean }) {
  return (
    <section>
      <h3 className="section-title" style={{ textTransform: 'none' }}>{dayLabel(day)}</h3>
      <ul className="list panel">
        {entry?.keys.map((k) => (
          <li key={k.id} className="list-row">
            <span className={`cal-badge k-${k.kind}`}>{KEY_LABEL[k.kind]}</span>
            <span className="grow">{k.title}</span>
            {showClient && k.client && <span className="muted small">{k.client}</span>}
          </li>
        ))}
        {entry?.content.map((i) => {
          const s = stage(i.estado);
          return (
            <li key={i.id} className="list-row">
              <span className="type-dot" style={{ background: FORMAT_TONE(i) }} />
              <div className="grow">
                <div>{i.title}</div>
                <div className="muted small">
                  {[i.formato, i.plataforma, i.cuenta, i.pilar, showClient ? i.client : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className={`tag ${s.tone}`}>{s.label}</span>
            </li>
          );
        })}
        {!entry?.content.length && !entry?.keys.length && <li className="empty">Nada programado este día.</li>}
      </ul>
    </section>
  );
}
