/** Verticales del negocio. Mismo nombre que la propiedad "Vertical" de los trackers en Notion. */
export const VERTICALS = ['Fractal Consulting', 'Creative Lab', 'Baseline', 'Marcas personales', 'B2B'] as const;
export type Vertical = (typeof VERTICALS)[number];

export const asVertical = (v: unknown): Vertical | null =>
  (VERTICALS as readonly string[]).includes(String(v)) ? (v as Vertical) : null;
