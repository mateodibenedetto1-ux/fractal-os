/**
 * Importa los clientes de Notion (Wiki Clients → Clientes) a Fractal OS.
 *
 * Por cada cliente busca dentro de su página las bases:
 *   - "Command Center — Tareas …" / "Tasks Tracker …"  → accionables
 *   - "Roadmap …"   → llamadas (Type = Llamada) e hitos (Type = Hito)
 *   - "Biblioteca …" → documentos de la biblioteca
 *
 * Se puede correr varias veces: actualiza por notion_id y no duplica.
 *
 * Uso:
 *   1. Creá una integración interna en https://www.notion.so/profile/integrations y copiá el token.
 *   2. En Notion, abrí "Wiki Clients" → ••• → Conexiones → agregá la integración.
 *   3. Completá NOTION_TOKEN, NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
 *   4. npm run import:notion            (todos los clientes)
 *      npm run import:notion BRAINZEED  (solo los que contengan ese texto)
 */
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// --- .env.local sin dependencias ---
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const CLIENTES_DB = process.env.NOTION_CLIENTES_DB ?? '35c7e0f1e2138082bad6f0dfbd42f630';
const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) throw new Error('Falta NOTION_TOKEN');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const filter = (process.argv[2] ?? '').toLowerCase();

// ---------- Notion API ----------
async function notion(path: string, body?: unknown): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.notion.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
    const json = await res.json();
    if (!res.ok) throw new Error(`${path}: ${json.message ?? res.status}`);
    return json;
  }
  throw new Error(`${path}: demasiados reintentos`);
}

async function queryAll(dbId: string) {
  const rows: any[] = [];
  let cursor: string | undefined;
  do {
    const r = await notion(`databases/${dbId}/query`, { page_size: 100, start_cursor: cursor });
    rows.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return rows;
}

async function children(blockId: string) {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const r = await notion(`blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}

/** Recorre la página del cliente buscando bases de datos (incluye toggles, columnas y subpáginas). */
async function findDatabases(blockId: string, depth = 0, acc: { id: string; title: string }[] = []) {
  if (depth > 4) return acc;
  for (const b of await children(blockId)) {
    if (b.type === 'child_database') acc.push({ id: b.id, title: b.child_database.title ?? '' });
    else if (b.has_children && ['toggle', 'heading_1', 'heading_2', 'heading_3', 'column_list', 'column', 'child_page', 'callout', 'synced_block'].includes(b.type)) {
      await findDatabases(b.id, depth + 1, acc);
    }
  }
  return acc;
}

// ---------- Propiedades ----------
const plain = (rt: any[] | undefined) => (rt ?? []).map((t) => t.plain_text).join('').trim();
function prop(page: any, ...names: string[]) {
  for (const n of names) {
    const key = Object.keys(page.properties).find((k) => k.trim().toLowerCase() === n.toLowerCase());
    if (key) return page.properties[key];
  }
  return undefined;
}
function title(page: any) {
  const p = Object.values<any>(page.properties).find((x) => x.type === 'title');
  return plain(p?.title) || 'Sin título';
}
function text(p: any): string | null {
  if (!p) return null;
  switch (p.type) {
    case 'rich_text': return plain(p.rich_text) || null;
    case 'select': return p.select?.name ?? null;
    case 'status': return p.status?.name ?? null;
    case 'url': return p.url ?? null;
    case 'title': return plain(p.title) || null;
    default: return null;
  }
}
const date = (p: any): string | null => p?.date?.start ?? null;
const relIds = (p: any): string[] => (p?.relation ?? []).map((r: any) => r.id);

const PRIORITY: Record<string, string> = { crítica: 'critica', critica: 'critica', alta: 'alta', media: 'media', baja: 'baja' };
const isDone = (s: string | null) => !!s && /done|ready|listo|complet|hecho/i.test(s);

// ---------- Bloques → Markdown (lo básico) ----------
async function pageToMarkdown(pageId: string, depth = 0): Promise<string> {
  if (depth > 2) return '';
  const lines: string[] = [];
  for (const b of await children(pageId)) {
    const t = plain(b[b.type]?.rich_text);
    switch (b.type) {
      case 'heading_1': case 'heading_2': lines.push(`## ${t}`); break;
      case 'heading_3': lines.push(`### ${t}`); break;
      case 'bulleted_list_item': lines.push(`- ${t}`); break;
      case 'numbered_list_item': lines.push(`1. ${t}`); break;
      case 'to_do': lines.push(`- [${b.to_do.checked ? 'x' : ' '}] ${t}`); break;
      case 'quote': case 'callout': lines.push(`> ${t}`); break;
      case 'divider': lines.push('---'); break;
      case 'paragraph': lines.push(t); break;
      case 'bookmark': case 'link_preview': case 'embed': lines.push(`[${b[b.type].url}](${b[b.type].url})`); break;
      default: if (t) lines.push(t);
    }
    if (b.has_children && ['toggle', 'bulleted_list_item', 'numbered_list_item', 'column_list', 'column', 'callout'].includes(b.type)) {
      const inner = await pageToMarkdown(b.id, depth + 1);
      if (inner) lines.push(inner);
    }
    lines.push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- Importación ----------
async function main() {
  const { data: agency } = await sb.from('organizations').select('id').eq('kind', 'agency').single();
  if (!agency) throw new Error('Corré primero supabase/schema.sql');

  const rows = await queryAll(CLIENTES_DB);
  console.log(`Clientes en Notion: ${rows.length}`);

  for (const row of rows) {
    const rawName = title(row).replace(/\s*-\s*New\s*$/i, '').trim();
    if (filter && !rawName.toLowerCase().includes(filter)) continue;
    if (row.properties['Parent item']?.relation?.length) continue; // sub-items

    const estado = text(prop(row, 'Estado')) ?? '';
    const month = (text(prop(row, 'Mes')) ?? '').match(/\d+/)?.[0];
    const slug = slugify(rawName);

    const { data: org, error } = await sb.from('organizations').upsert({
      parent_id: agency.id, kind: 'client', name: rawName, slug,
      status: /finaliz/i.test(estado) ? 'finalizado' : /activo/i.test(estado) ? 'activo' : 'onboarding',
      offer: text(prop(row, 'Oferta')),
      program_month: month ? Number(month) : null,
      start_date: date(prop(row, 'Start Date')),
      next_step: text(prop(row, 'NEXT STEP')),
      notion_url: row.url,
    }, { onConflict: 'slug' }).select('id').single();
    if (error || !org) { console.error(rawName, error?.message); continue; }

    const dbs = await findDatabases(row.id);
    console.log(`\n${rawName}: ${dbs.map((d) => d.title).join(' | ') || 'sin bases'}`);

    // Roadmap: llamadas e hitos
    const callByNotion = new Map<string, string>();
    for (const db of dbs.filter((d) => /roadmap/i.test(d.title))) {
      const items = await queryAll(db.id);
      let pos = 0;
      for (const it of items) {
        const type = text(prop(it, 'Type')) ?? '';
        const status = text(prop(it, 'Estado')) ?? '';
        if (/llamada/i.test(type)) {
          const { data: call } = await sb.from('calls').upsert({
            org_id: org.id, title: title(it), source: 'notion', notion_id: it.id,
            held_at: date(prop(it, 'Date')) ?? it.created_time,
            share_url: text(prop(it, 'Link llamada')),
            status: 'procesada',
          }, { onConflict: 'notion_id' }).select('id').single();
          if (call) callByNotion.set(it.id, call.id);
          const docUrl = text(prop(it, 'Documento'));
          if (docUrl) await sb.from('resources').upsert({ org_id: org.id, call_id: call?.id, title: `Documento · ${title(it)}`, url: docUrl, kind: 'doc' }, { onConflict: 'org_id,url' });
        } else {
          await sb.from('milestones').upsert({
            org_id: org.id, title: title(it), notion_id: it.id, position: pos++,
            due_date: date(prop(it, 'Date')),
            status: isDone(status) ? 'listo' : /progress|curso/i.test(status) ? 'en_curso' : 'pendiente',
          }, { onConflict: 'notion_id' });
        }
      }
      console.log(`  roadmap: ${items.length} filas, ${callByNotion.size} llamadas`);
    }

    // Tareas → accionables
    for (const db of dbs.filter((d) => /tarea|task|command center/i.test(d.title))) {
      const items = await queryAll(db.id);
      let pos = 0;
      for (const it of items) {
        const phase = relIds(prop(it, 'Roadmap Phase', 'Roadmap', 'Llamada')).find((id) => callByNotion.has(id));
        const notes = text(prop(it, 'Notes & Links', 'Notas'));
        await sb.from('action_items').upsert({
          org_id: org.id, title: title(it), notion_id: it.id, source: 'notion', position: pos++,
          call_id: phase ? callByNotion.get(phase) : null,
          done: isDone(text(prop(it, 'Estado', 'Status'))),
          priority: PRIORITY[(text(prop(it, 'Prioridad', 'Priority')) ?? '').toLowerCase()] ?? null,
          area: text(prop(it, 'Area', 'Área')),
          due_date: date(prop(it, 'Fecha Limite', 'Fecha límite', 'Due')),
          why: notes && !/^https?:\/\//.test(notes) ? notes.slice(0, 400) : null,
        }, { onConflict: 'notion_id' });
        if (notes) for (const url of notes.match(/https?:\/\/\S+/g) ?? []) {
          await sb.from('resources').upsert({ org_id: org.id, title: title(it), url, kind: 'link' }, { onConflict: 'org_id,url', ignoreDuplicates: true });
        }
      }
      console.log(`  tareas: ${items.length}`);
    }

    // Biblioteca → documentos
    for (const db of dbs.filter((d) => /biblioteca|library/i.test(d.title))) {
      const items = await queryAll(db.id);
      for (const it of items) {
        const t = title(it);
        const kind = /diagn/i.test(t) ? 'diagnostico' : /sop/i.test(t) ? 'sop' : /resumen|llamada/i.test(t) ? 'resumen' : 'estrategia';
        const body = await pageToMarkdown(it.id);
        await sb.from('documents').upsert({
          org_id: org.id, title: t, kind, notion_id: it.id,
          body_md: body || `_Documento importado de Notion._\n\n[Abrir en Notion](${it.url})`,
          created_at: it.created_time,
        }, { onConflict: 'notion_id' });
      }
      console.log(`  biblioteca: ${items.length}`);
    }
  }
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
