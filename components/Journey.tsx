import Link from 'next/link';
import { BRAIN, brainPct, sectionPct, type BrainData } from '@/lib/brain';

/** Recorrido Fractal: el avance del cliente de Consulting etapa por etapa. */
export function JourneyCard({ data, href }: { data: BrainData; href: string }) {
  const total = brainPct(data);
  const current = BRAIN.find((s) => sectionPct(data, s) < 80) ?? BRAIN[BRAIN.length - 1];
  const doneStages = BRAIN.filter((s) => sectionPct(data, s) >= 80).length;
  const msg =
    total === 0 ? 'Tu recorrido empieza por el punto de partida: contanos dónde está tu negocio hoy.'
    : doneStages === BRAIN.length ? 'Completaste todo tu recorrido. Tu Segundo cerebro ya guía cada paso.'
    : `Vas por la etapa ${current.n}: ${current.stage}. Cada sección que completás le da más contexto a tu estrategia y a la IA de Fractal.`;
  return (
    <Link href={href} className="panel journey">
      <div className="journey-head">
        <div>
          <span className="journey-kicker">Tu Recorrido Fractal</span>
          <p>{msg}</p>
        </div>
        <span className="journey-pct">{total}<small>%</small></span>
      </div>
      <ol className="journey-steps">
        {BRAIN.map((s) => {
          const p = sectionPct(data, s);
          return (
            <li key={s.k} className={`${p >= 80 ? 'done' : ''} ${s.k === current.k ? 'now' : ''}`} title={`${s.title} · ${p}%`}>
              <i style={{ ['--p' as string]: `${p}%` }} />
              <span>{s.stage}</span>
            </li>
          );
        })}
      </ol>
      <span className="journey-cta">{total === 0 ? 'Empezar' : 'Seguir completando'} →</span>
    </Link>
  );
}
