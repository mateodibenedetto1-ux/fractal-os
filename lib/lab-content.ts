// Síntesis del Laboratorio de Servicio — FRACTAL (Notion). El detalle completo se lee desde Notion.

export const METHOD = [
  { name: 'Registrar', text: 'Anotar lo que pasó con su fuente: llamada, mensaje o métrica. Sin interpretar todavía.' },
  { name: 'Entender', text: 'Separar hecho de interpretación y buscar la causa probable.' },
  { name: 'Probar', text: 'Convertirlo en una regla o experimento chico, con dueño y fecha.' },
  { name: 'Estandarizar', text: 'Si funciona, pasa a SOP u onboarding y deja de depender de la memoria.' },
];

export const TIPOS = ['Falla', 'Aprendizaje', 'Feedback', 'Experimento', 'Hipótesis', 'Decisión', 'SOP'] as const;

export const TIPO_PLURAL: Record<string, string> = {
  Falla: 'Fallas', Aprendizaje: 'Aprendizajes', Feedback: 'Feedbacks', Experimento: 'Experimentos',
  Hipótesis: 'Hipótesis', Decisión: 'Decisiones', SOP: 'SOPs',
};

export const TIPO_HELP: Record<string, string> = {
  Falla: 'Algo que salió mal y tuvo costo.',
  Aprendizaje: 'Qué haríamos distinto la próxima vez.',
  Feedback: 'Lo que dijo un cliente, sin filtrar.',
  Experimento: 'Algo que vamos a probar, con resultado a medir.',
  Hipótesis: 'Una explicación posible que falta validar.',
  Decisión: 'Un criterio ya acordado por el equipo.',
  SOP: 'Proceso estandarizado.',
};

export const ESTADOS = ['Capturado', 'En análisis', 'En prueba', 'Validado', 'Archivado'] as const;

export const VAULT_LINKS = [
  { id: '3527e0f1e21380879b99c59b5de1b29e', title: 'Fractals Vault', text: 'SOPs vigentes.' },
  { id: '3557e0f1e21380b59c78e169ff33e92e', title: 'Museo de incidentes', text: 'Historial de incidentes pasados.' },
  { id: '3557e0f1e21380e19fe8d78fbfcc211d', title: 'Reporting', text: 'Evidencia cuantitativa.' },
];
