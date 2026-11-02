import Link from 'next/link';
import { MODULES, brainPct, modulePct, type BrainData } from '@/lib/brain';

/** Recorrido Fractal: el avance del cliente de Consulting módulo por módulo. */
export function JourneyCard({ data, href }: { data: BrainData; href: string }) {
  const total = brainPct(data);
  const current = MODULES.find((m) => modulePct(data, m) < 80) ?? MODULES[MODULES.length - 1];
  const done = MODULES.filter((m) => modulePct(data, m) >= 80).length;
  const msg =
    total === 0 ? 'Tu recorrido empieza por el módulo 01: contanos dónde está tu negocio hoy y quién es tu cliente ideal.'
    : done === MODULES.length ? 'Completaste los 9 módulos. Tu Segundo cerebro ya guía cada paso.'
    : `Vas por el módulo ${current.n}: ${current.title}. ${current.about} Cada sección que completás le da más contexto a tu estrategia y a la IA de Fractal.`;
  return (
    <Link href={href} className="panel journey">
      <div className="journey-head">
        <div>
          <span className="journey-kicker">Tu Recorrido Fractal · 3 meses</span>
          <p>{msg}</p>
        </div>
        <span className="journey-pct">{total}<small>%</small></span>
      </div>
      <ol className="journey-steps">
        {MODULES.map((m) => {
          const p = modulePct(data, m);
          return (
            <li key={m.k} className={`${p >= 80 ? 'done' : ''} ${m.k === current.k ? 'now' : ''}`} title={`${m.n} · ${m.title} · ${p}%`}>
              <i style={{ ['--p' as string]: `${p}%` }} />
              <span>{m.n} {m.title}</span>
            </li>
          );
        })}
      </ol>
      <span className="journey-cta">{total === 0 ? 'Empezar' : 'Seguir completando'} →</span>
    </Link>
  );
}
