import type { Doc } from './types';

export const DOC_KIND: Record<Doc['kind'], string> = {
  estrategia: 'Estrategia',
  diagnostico: 'Fundamentos',
  sop: 'SOPs',
  reporte: 'Reportes semanales',
  objetivos: 'Objetivos',
  resumen: 'Resúmenes de llamadas',
  nota: 'Notas',
};
