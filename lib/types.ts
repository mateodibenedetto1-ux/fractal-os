export type OrgStatus = 'onboarding' | 'activo' | 'pausado' | 'finalizado';

export interface Org {
  id: string;
  parent_id: string | null;
  kind: 'agency' | 'client';
  name: string;
  slug: string;
  status: OrgStatus;
  offer: string | null;
  program_month: number | null;
  start_date: string | null;
  next_step: string | null;
  contact_name: string | null;
  contact_email: string | null;
  email_domains: string[];
  drive_url: string | null;
  tracker_url: string | null;
  program_url: string | null;
  notion_url: string | null;
  accent: string | null;
  notion_tasks_db?: string | null;
  notion_roadmap_db?: string | null;
  notion_calendars?: { id: string; label: string }[];
  last_synced_at?: string | null;
  responsables?: Responsable[];
  created_at: string;
}

export interface Responsable {
  name: string;
  side: 'cliente' | 'fractal';
  notion_user?: string | null;
  /** Otras personas de Notion que cuentan como este responsable (por ejemplo, el resto del equipo de Fractal). */
  notion_alt?: string[];
}

export interface Call {
  id: string;
  org_id: string | null;
  title: string;
  held_at: string;
  source: 'fathom' | 'manual' | 'notion';
  recording_id: number | null;
  fathom_url: string | null;
  share_url: string | null;
  summary_md: string | null;
  invitee_emails: string[];
  status: 'pendiente' | 'procesada' | 'error';
  error: string | null;
  created_at: string;
}

export interface ActionItem {
  id: string;
  org_id: string;
  call_id: string | null;
  parent_id: string | null;
  title: string;
  why: string | null;
  area: string | null;
  priority: 'critica' | 'alta' | 'media' | 'baja' | null;
  owner: 'cliente' | 'fractal';
  responsable?: string | null;
  notion_id?: string | null;
  notion_dirty?: boolean;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  position: number;
  source: string;
  created_at: string;
}

export type ResourceKind = 'doc' | 'sheet' | 'slides' | 'folder' | 'video' | 'page' | 'link';

export interface Resource {
  id: string;
  org_id: string;
  call_id: string | null;
  title: string;
  url: string;
  kind: ResourceKind;
  description: string | null;
  created_at: string;
}

export interface Doc {
  id: string;
  org_id: string;
  call_id: string | null;
  title: string;
  kind: 'resumen' | 'reporte' | 'objetivos' | 'sop' | 'estrategia' | 'diagnostico' | 'nota';
  body_md: string;
  notion_id?: string | null;
  visible_to_client: boolean;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  org_id: string;
  title: string;
  detail: string | null;
  due_date: string | null;
  status: 'pendiente' | 'en_curso' | 'listo';
  position: number;
  kind?: 'fase' | 'hito';
  auto_status?: boolean;
}

export interface LabEntry {
  id: string;
  notion_id: string | null;
  title: string;
  tipo: string | null;
  area: string | null;
  estado: string;
  prioridad: string | null;
  cliente: string | null;
  responsable: string | null;
  fecha: string | null;
  fuente: string | null;
  notas: string | null;
  created_at: string;
}

export interface FathomConnection {
  id: string;
  label: string;
  webhook_secret: string | null;
  last_event_at: string | null;
  created_at: string;
}

export interface Viewer {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
  clientOrgIds: string[];
}

export interface ClientSummary extends Org {
  pending: number;
  total: number;
  lastCallAt: string | null;
}

export interface LabPage {
  id: string;
  notion_id: string;
  section: 'cliente' | 'criterio';
  client: string | null;
  title: string;
  happened: string | null;
  learning: string | null;
  rule: string | null;
  summary: string | null;
  position: number;
}
