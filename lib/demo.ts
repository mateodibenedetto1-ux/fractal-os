// Datos de ejemplo para ver la app sin base de datos (modo demo).
import type { ActionItem, Call, Doc, FathomConnection, Milestone, Org, Resource } from './types';

const AG = 'org-fractal';
const now = new Date('2026-10-28T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 864e5).toISOString();

function org(id: string, name: string, slug: string, extra: Partial<Org> = {}): Org {
  return {
    id, parent_id: AG, kind: 'client', name, slug, status: 'activo', offer: 'Consultoría',
    program_month: 2, start_date: '2026-09-01', next_step: null, contact_name: null, contact_email: null,
    email_domains: [], drive_url: 'https://drive.google.com', tracker_url: null,
    program_url: null, notion_url: null, accent: null, created_at: daysAgo(60), ...extra,
  };
}

export const demoOrgs: Org[] = [
  { ...org(AG, 'Fractal', 'fractal'), kind: 'agency', parent_id: null },
  org('org-norte', 'Estudio Norte', 'estudio-norte', {
    contact_name: 'Tomás', program_month: 2, next_step: 'Lanzar nuevos ads con el ICP actualizado',
    email_domains: ['estudionorte.com'],
  }),
  org('org-alba', 'Alba Wellness', 'alba-wellness', {
    contact_name: 'Lucía', program_month: 4, offer: 'B2B', next_step: 'Cerrar secuencia de onboarding',
  }),
  org('org-ruta', 'Ruta Coaching', 'ruta-coaching', {
    contact_name: 'Martín', status: 'onboarding', program_month: 1, next_step: 'Completar diagnóstico operativo',
  }),
];

export const demoCalls: Call[] = [
  call('call-1', 'org-norte', 'Llamada 1:1 — Ajuste de funnel', 23),
  call('call-2', 'org-norte', 'Llamada 1:1 — ICP y anuncios', 8),
  call('call-3', 'org-alba', 'Revisión de métricas de septiembre', 12),
  { ...call('call-4', null, 'Llamada con prospecto — Clínica Sur', 1), invitee_emails: ['dra.paz@clinicasur.com'], status: 'pendiente' },
];

function call(id: string, org_id: string | null, title: string, ago: number): Call {
  return {
    id, org_id, title, held_at: daysAgo(ago), source: 'fathom', recording_id: null,
    fathom_url: 'https://fathom.video', share_url: 'https://fathom.video', invitee_emails: [],
    summary_md: null, status: 'procesada', error: null, created_at: daysAgo(ago),
  };
}

let n = 0;
function ai(org_id: string, call_id: string | null, title: string, done = false, extra: Partial<ActionItem> = {}): ActionItem {
  n++;
  return {
    id: `ai-${n}`, org_id, call_id, parent_id: null, title, why: null, area: null, priority: null,
    owner: 'cliente', due_date: null, done, done_at: done ? daysAgo(3) : null, position: n,
    source: 'fathom', created_at: daysAgo(10), ...extra,
  };
}

export const demoActions: ActionItem[] = [
  ai('org-norte', 'call-2', 'Subir los nuevos ads en base al ICP (DMs y lead magnet)', false, {
    why: 'El ICP nuevo responde mejor a la promesa de resultado concreto; los ads actuales hablan de proceso.',
    area: 'Adquisición', priority: 'alta',
  }),
  { ...ai('org-norte', 'call-2', 'Sistemas backend del funnel'), parent_id: 'ai-1' },
  ai('org-norte', 'call-2', 'Videos en YouTube y contenido largo', false, { area: 'Contenido' }),
  ai('org-norte', 'call-2', 'Revisar el proceso de setting del lead magnet', false, { area: 'Comercial' }),
  ai('org-norte', 'call-1', 'Actualizar secuencias de historias de testimonios', false, {
    why: 'Los testimonios son el principal motivo de compra de tus clientes.', area: 'Contenido', priority: 'media',
  }),
  ai('org-norte', 'call-1', 'Definir oferta de entrada', true),
  ai('org-norte', 'call-1', 'Grabar 3 historias de autoridad', true),
  ai('org-norte', 'call-1', 'Ordenar carpeta de fuentes de información', true),
  ai('org-alba', 'call-3', 'Pasar el tracker de métricas a formato semanal', false, { area: 'Métricas' }),
  ai('org-alba', 'call-3', 'Cerrar guion de llamada de venta', true),
  ai('org-ruta', null, 'Completar formulario de diagnóstico', false, { area: 'General', priority: 'critica' }),
];

export const demoResources: Resource[] = [
  res('org-norte', 'call-1', 'Biblia del cliente ideal', 'https://docs.google.com/document/d/demo1', 'doc'),
  res('org-norte', 'call-1', 'Secuencias de historias', 'https://docs.google.com/document/d/demo2', 'doc'),
  res('org-norte', 'call-1', 'Tracker de métricas', 'https://docs.google.com/spreadsheets/d/demo3', 'sheet'),
  res('org-norte', 'call-1', 'Fuentes de info', 'https://drive.google.com/drive/folders/demo4', 'folder'),
  res('org-alba', 'call-3', 'Guion de llamada de venta', 'https://docs.google.com/document/d/demo5', 'doc'),
];

function res(org_id: string, call_id: string, title: string, url: string, kind: Resource['kind']): Resource {
  return { id: `res-${title}`, org_id, call_id, title, url, kind, description: null, created_at: daysAgo(20) };
}

export const demoDocs: Doc[] = [
  {
    id: 'doc-1', org_id: 'org-norte', call_id: 'call-2', title: 'Resumen — Llamada 1:1 — ICP y anuncios', kind: 'resumen',
    visible_to_client: true, created_at: daysAgo(8), updated_at: daysAgo(8),
    body_md: `## Dónde estamos\nEl funnel de lead magnet ya convierte, pero los anuncios siguen hablándole al ICP anterior.\n\n## Decisiones\n- Reescribir los ads con la promesa de resultado concreto.\n- El setting pasa a responder en menos de 2 horas.\n\n## Próximos pasos\n1. Subir los nuevos ads.\n2. Revisar el proceso de setting.\n3. Empezar a publicar contenido largo en YouTube.`,
  },
  {
    id: 'doc-2', org_id: 'org-norte', call_id: null, title: 'SOP — Publicación de historias', kind: 'sop',
    visible_to_client: true, created_at: daysAgo(30), updated_at: daysAgo(30),
    body_md: `## Objetivo\nPublicar una secuencia diaria que lleve a la conversación por DM.\n\n## Pasos\n1. Historia de contexto.\n2. Historia de prueba (testimonio).\n3. Historia con llamado a la acción.`,
  },
];

export const demoMilestones: Milestone[] = [
  { id: 'm1', org_id: 'org-norte', title: 'Diagnóstico y ICP', detail: 'Biblia del cliente ideal y oferta', due_date: '2026-09-15', status: 'listo', position: 1 },
  { id: 'm2', org_id: 'org-norte', title: 'Funnel de lead magnet activo', detail: 'Ads + setting + seguimiento', due_date: '2026-10-31', status: 'en_curso', position: 2 },
  { id: 'm3', org_id: 'org-norte', title: 'Contenido largo y autoridad', detail: 'YouTube semanal', due_date: '2026-11-30', status: 'pendiente', position: 3 },
];

export const demoConnections: FathomConnection[] = [
  { id: '00000000-0000-0000-0000-000000000001', label: 'Mateo', webhook_secret: null, last_event_at: null, created_at: daysAgo(5) },
];
