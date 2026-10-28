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
  created_at: string;
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
  kind: 'resumen' | 'sop' | 'estrategia' | 'diagnostico' | 'nota';
  body_md: string;
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
