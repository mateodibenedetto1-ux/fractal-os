export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!iso) return '';
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  return d.toLocaleDateString('es-AR', opts);
}

export function fmtShort(iso: string | null | undefined) {
  return fmtDate(iso, { day: 'numeric', month: 'short' });
}

export function relative(iso: string | null | undefined) {
  if (!iso) return 'todavía no';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  const m = Math.round(days / 30);
  return m === 1 ? 'hace un mes' : `hace ${m} meses`;
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const STATUS_LABEL: Record<string, string> = {
  onboarding: 'Onboarding', activo: 'Activo', pausado: 'Pausado', finalizado: 'Finalizado',
};

export const PRIORITY_LABEL: Record<string, string> = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };
