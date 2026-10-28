import crypto from 'node:crypto';

/** Payload del webhook "new meeting content ready" de Fathom (campos que usamos). */
export interface FathomMeeting {
  title: string;
  meeting_title?: string | null;
  recording_id: number;
  url: string;
  share_url: string;
  created_at: string;
  scheduled_start_time?: string | null;
  recording_start_time?: string | null;
  transcript_language?: string;
  transcript?: { speaker: { display_name: string; matched_calendar_invitee_email?: string | null }; text: string; timestamp: string }[] | null;
  default_summary?: { template_name?: string | null; markdown_formatted?: string | null } | null;
  action_items?: {
    description: string;
    completed: boolean;
    recording_timestamp: string;
    recording_playback_url: string;
    assignee?: { name?: string | null; email?: string | null } | null;
  }[] | null;
  calendar_invitees?: { name?: string | null; email?: string | null; email_domain?: string | null; is_external: boolean }[];
  recorded_by?: { name: string; email: string };
}

/** Verificación de firma según la documentación de Fathom (HMAC SHA-256, estilo Standard Webhooks). */
export function verifyFathomSignature(secret: string, headers: Headers, rawBody: string, toleranceSec = 300): boolean {
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const sigHeader = headers.get('webhook-signature');
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(ts, 10)) > toleranceSec) return false;

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest('base64');
  const exp = Buffer.from(expected);
  return sigHeader.split(' ').some((part) => {
    const sig = Buffer.from(part.includes(',') ? part.split(',')[1] : part);
    return sig.length === exp.length && crypto.timingSafeEqual(sig, exp);
  });
}

export function transcriptToText(m: Pick<FathomMeeting, 'transcript'>, maxChars = 180_000): string {
  const text = (m.transcript ?? []).map((t) => `[${t.timestamp}] ${t.speaker.display_name}: ${t.text}`).join('\n');
  return text.length > maxChars ? text.slice(0, maxChars) + '\n[…transcript recortado…]' : text;
}

/** Emails externos de la llamada (los del cliente). */
export function externalEmails(m: FathomMeeting): string[] {
  return (m.calendar_invitees ?? [])
    .filter((i) => i.is_external && i.email)
    .map((i) => i.email!.toLowerCase());
}

const URL_RE = /https?:\/\/[^\s)\]>"']+/g;

/** Links que se nombraron en la llamada (chat o transcript). */
export function linksIn(text: string): string[] {
  return Array.from(new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;:]+$/, ''))));
}
