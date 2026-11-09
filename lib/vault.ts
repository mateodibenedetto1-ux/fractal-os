import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase/admin';
import { NOTION_DB, hasNotion, notionPageMarkdown, pageTitle, plainId, prop, queryDatabase } from './notion';

export interface VaultReport {
  id: string; notion_id: string; title: string; tipo: string | null; week_start: string | null; week_end: string | null;
  clientes: string[]; resumen: string | null; body_md: string | null; updated_at: string;
}

/** Bóveda de reportes de Notion → vault_reports. Trae el cuerpo solo de las páginas que cambiaron. */
export async function syncVaultFromNotion(sb: SupabaseClient): Promise<{ count: number; error?: string }> {
  if (!hasNotion()) return { count: 0, error: 'Falta NOTION_TOKEN' };
  try {
    const rows = await queryDatabase(NOTION_DB.vault);
    const { data: known } = await sb.from('vault_reports').select('notion_id, notion_edited');
    const prev = new Map((known ?? []).map((k) => [k.notion_id, k.notion_edited as string | null]));
    await Promise.all(rows.map(async (r) => {
      const id = plainId(r.id);
      const changed = !prev.get(id) || new Date(prev.get(id)!).getTime() < new Date(r.last_edited_time).getTime();
      const semana = prop(r, 'Semana')?.date;
      const clientes = (prop(r, 'Clientes')?.multi_select ?? []).map((o: { name: string }) => o.name);
      await sb.from('vault_reports').upsert({
        notion_id: id, title: pageTitle(r), tipo: prop(r, 'Tipo')?.select?.name ?? null,
        week_start: semana?.start?.slice(0, 10) ?? null, week_end: semana?.end?.slice(0, 10) ?? null,
        clientes, resumen: (prop(r, 'Resumen')?.rich_text ?? []).map((t: { plain_text: string }) => t.plain_text).join('') || null,
        ...(changed ? { body_md: await notionPageMarkdown(r.id), notion_edited: r.last_edited_time } : {}),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'notion_id' });
    }));
    // Lo que se borró en Notion se borra acá
    const ids = rows.map((r) => plainId(r.id));
    if (ids.length) await sb.from('vault_reports').delete().not('notion_id', 'in', `(${ids.map((i) => `"${i}"`).join(',')})`);
    return { count: rows.length };
  } catch (e) {
    return { count: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getVault() {
  const sb = supabaseAdmin();
  const [{ data: reports }, { data: daily }] = await Promise.all([
    sb.from('vault_reports').select('*').order('week_start', { ascending: false, nullsFirst: false }).order('updated_at', { ascending: false }),
    sb.from('daily_reports').select('id, day, author, done, pending, blockers, next_steps, top_content, notes, published, planned, notion_id').order('day', { ascending: false }).limit(60),
  ]);
  return { reports: (reports ?? []) as VaultReport[], daily: daily ?? [] };
}
