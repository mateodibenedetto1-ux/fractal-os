/** Marcas y clientes en orden de foco. Lo usan objetivos y el plan semanal. */
export const BRANDS = [
  { k: 'Fractal Consulting', color: '#7a2e2a' },
  { k: 'Baseline Creative', color: '#8a6bb8' },
  { k: 'Marca Mateo', color: '#2c5d8a' },
  { k: 'Marca Lorena', color: '#b5577a' },
  { k: 'Val · Seres Magnéticos', color: '#c07a2c' },
  { k: 'Marcela · BRAINZEED', color: '#2f6b4f' },
  { k: 'Andrea & Exe', color: '#8b8f8d' },
  { k: 'Fractal', color: '#5b6562' },
] as const;

export type Brand = (typeof BRANDS)[number]['k'];
export const brandColor = (b: string | null | undefined) => BRANDS.find((x) => x.k === b)?.color ?? '#5b6562';
export const OWN_BRANDS: string[] = ['Fractal Consulting', 'Baseline Creative', 'Marca Mateo', 'Marca Lorena'];

const BY_SLUG: Record<string, Brand> = {
  'val-lollett': 'Val · Seres Magnéticos',
  brainzeed: 'Marcela · BRAINZEED',
  'andrea-exe': 'Andrea & Exe',
};

/** Marca de una tarea: el cliente si lo tiene; si es interna, por el título del tracker. */
export function brandOf(t: { title: string; orgSlug?: string | null; clientSlug?: string | null }): Brand {
  const slug = t.clientSlug ?? (t.orgSlug && BY_SLUG[t.orgSlug] ? t.orgSlug : null);
  if (slug && BY_SLUG[slug]) return BY_SLUG[slug];
  const s = t.title.toLowerCase();
  if (/creative lab|baseline/.test(s)) return 'Baseline Creative';
  if (/consulting|fractal os|growth os|growth system|icp|one-sheet|portafolio/.test(s)) return 'Fractal Consulting';
  if (/\blore\b|lorena/.test(s)) return 'Marca Lorena';
  if (/mateo youtube|mi marca|mi propia marca|grabarme|grabándome|reboot|youtube/.test(s)) return 'Marca Mateo';
  return 'Fractal';
}
