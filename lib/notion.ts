import 'server-only';

/** Marca que se pone en body_md de un documento importado cuyo contenido se trae de Notion al abrirlo. */
export const NOTION_MARKER = '<!--notion-->';

const TOKEN = () => process.env.NOTION_TOKEN;

async function children(blockId: string): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await fetch(
      `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`,
      { headers: { Authorization: `Bearer ${TOKEN()}`, 'Notion-Version': '2022-06-28' }, cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`Notion ${res.status}`);
    const json = await res.json();
    out.push(...json.results);
    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);
  return out;
}

function rich(rt: any[] | undefined): string {
  return (rt ?? [])
    .map((t) => {
      let s: string = t.plain_text ?? '';
      if (!s.trim()) return s;
      if (t.annotations?.code) s = '`' + s + '`';
      if (t.annotations?.bold) s = `**${s}**`;
      if (t.annotations?.italic) s = `*${s}*`;
      if (t.href && /^https?:/.test(t.href)) s = `[${s}](${t.href})`;
      return s;
    })
    .join('');
}

async function blocksToMarkdown(id: string, depth = 0): Promise<string> {
  if (depth > 3) return '';
  const lines: string[] = [];
  const pad = '  '.repeat(depth);
  for (const b of await children(id)) {
    const v = b[b.type] ?? {};
    const t = rich(v.rich_text);
    switch (b.type) {
      case 'heading_1':
      case 'heading_2': lines.push(`\n## ${t}\n`); break;
      case 'heading_3': lines.push(`\n### ${t}\n`); break;
      case 'bulleted_list_item': lines.push(`${pad}- ${t}`); break;
      case 'numbered_list_item': lines.push(`${pad}1. ${t}`); break;
      case 'to_do': lines.push(`${pad}- [${v.checked ? 'x' : ' '}] ${t}`); break;
      case 'quote':
      case 'callout': lines.push(`\n> ${t}\n`); break;
      case 'divider': lines.push('\n---\n'); break;
      case 'paragraph': lines.push(t ? `\n${t}\n` : ''); break;
      case 'toggle': lines.push(`\n**${t}**\n`); break;
      case 'code': lines.push('\n```\n' + t + '\n```\n'); break;
      case 'bookmark':
      case 'embed':
      case 'link_preview': lines.push(`\n[${v.url}](${v.url})\n`); break;
      case 'child_page': lines.push(`\n**${v.title}**\n`); break;
      case 'table': {
        const rows = await children(b.id);
        rows.forEach((r, i) => {
          lines.push('| ' + (r.table_row?.cells ?? []).map((c: any[]) => rich(c).replace(/\|/g, '/')).join(' | ') + ' |');
          if (i === 0) lines.push('|' + ' --- |'.repeat(r.table_row?.cells?.length ?? 1));
        });
        lines.push('');
        continue;
      }
      default: if (t) lines.push(t);
    }
    if (b.has_children && b.type !== 'child_page' && b.type !== 'child_database') {
      const inner = await blocksToMarkdown(b.id, ['bulleted_list_item', 'numbered_list_item', 'to_do'].includes(b.type) ? depth + 1 : depth);
      if (inner) lines.push(inner);
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Trae el contenido de una página de Notion como Markdown. Devuelve null si no hay token o falla. */
export async function notionPageMarkdown(pageId: string): Promise<string | null> {
  if (!TOKEN()) return null;
  try {
    return await blocksToMarkdown(pageId);
  } catch {
    return null;
  }
}

// ============================================================
// API de Notion: lectura y escritura de bases
// ============================================================

/** IDs de las bases de Fractal en Notion (se pueden cambiar por variables de entorno). */
export const NOTION_DB = {
  atlas: process.env.NOTION_ATLAS_DB ?? 'f1e283474c2a42059568c1c21d4d01bd',
  goals: process.env.NOTION_GOALS_DB ?? '0e99110393d647589dcc5eaefdf70e26',
  rewards: process.env.NOTION_REWARDS_DB ?? 'ae77b03ceacb4ffbad485e36f337f74c',
};

export const hasNotion = () => Boolean(TOKEN());
export const plainId = (id: string) => id.replace(/-/g, '');
export const isNotionId = (id: string | null | undefined): id is string => !!id && /^[0-9a-f]{32}$/i.test(plainId(id));

export async function notionApi<T = any>(path: string, init: { method?: string; body?: unknown; revalidate?: number } = {}): Promise<T> {
  if (!TOKEN()) throw new Error('Falta NOTION_TOKEN');
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://api.notion.com/v1/${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: { Authorization: `Bearer ${TOKEN()}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: init.body ? JSON.stringify(init.body) : undefined,
      ...(init.revalidate !== undefined ? { next: { revalidate: init.revalidate } } : { cache: 'no-store' as const }),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json?.message ?? `Notion ${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return json as T;
  }
  throw new Error('Notion: demasiadas solicitudes');
}

export async function queryDatabase(dbId: string, body: Record<string, unknown> = {}, revalidate?: number): Promise<any[]> {
  const rows: any[] = [];
  let cursor: string | undefined;
  do {
    const r = await notionApi(`databases/${plainId(dbId)}/query`, {
      method: 'POST',
      body: { page_size: 100, ...body, ...(cursor ? { start_cursor: cursor } : {}) },
      revalidate,
    });
    rows.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return rows;
}

const schemaCache = new Map<string, { at: number; props: Record<string, any> }>();
export async function databaseProps(dbId: string): Promise<Record<string, any>> {
  const hit = schemaCache.get(dbId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.props;
  const db = await notionApi(`databases/${plainId(dbId)}`);
  schemaCache.set(dbId, { at: Date.now(), props: db.properties });
  return db.properties;
}

// ---------- Lectura de propiedades ----------
const txt = (rt: any[] | undefined) => (rt ?? []).map((t) => t.plain_text).join('').trim();

export function prop(page: any, ...names: string[]): any {
  const keys = Object.keys(page.properties ?? {});
  for (const n of names) {
    const k = keys.find((x) => x.trim().toLowerCase() === n.toLowerCase());
    if (k) return page.properties[k];
  }
  return undefined;
}

export function pageTitle(page: any): string {
  const p = Object.values<any>(page.properties ?? {}).find((x) => x.type === 'title');
  return txt(p?.title) || 'Sin título';
}

export function val(p: any): any {
  if (!p) return null;
  switch (p.type) {
    case 'title': return txt(p.title) || null;
    case 'rich_text': return txt(p.rich_text) || null;
    case 'select': return p.select?.name ?? null;
    case 'status': return p.status?.name ?? null;
    case 'multi_select': return (p.multi_select ?? []).map((o: any) => o.name);
    case 'date': return p.date?.start ?? null;
    case 'number': return p.number ?? null;
    case 'url': return p.url ?? null;
    case 'checkbox': return !!p.checkbox;
    case 'relation': return (p.relation ?? []).map((r: any) => plainId(r.id));
    case 'formula': return p.formula?.[p.formula?.type] ?? null;
    case 'people': return (p.people ?? []).map((x: any) => x.name).filter(Boolean);
    default: return null;
  }
}

// ---------- Escritura ----------

/** Arma propiedades solo con las columnas que existen en la base (cada cliente tiene su variante). */
export async function buildProps(dbId: string, values: Record<string, unknown>) {
  const schema = await databaseProps(dbId);
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    const key = Object.keys(schema).find((k) => k.trim().toLowerCase() === name.toLowerCase());
    if (!key) continue;
    const type = schema[key].type;
    if (type === 'title') out[key] = { title: [{ text: { content: String(value).slice(0, 1900) } }] };
    else if (type === 'rich_text') out[key] = { rich_text: [{ text: { content: String(value).slice(0, 1900) } }] };
    else if (type === 'select') out[key] = { select: { name: String(value) } };
    else if (type === 'status') out[key] = { status: { name: String(value) } };
    else if (type === 'date') out[key] = { date: { start: String(value) } };
    else if (type === 'number') out[key] = { number: Number(value) };
    else if (type === 'url') out[key] = { url: String(value) };
    else if (type === 'checkbox') out[key] = { checkbox: Boolean(value) };
  }
  return out;
}

export async function createRow(dbId: string, values: Record<string, unknown>): Promise<string> {
  const page = await notionApi('pages', { method: 'POST', body: { parent: { database_id: plainId(dbId) }, properties: await buildProps(dbId, values) } });
  return plainId(page.id);
}

/** Actualiza propiedades de una fila conociendo el nombre y tipo de la propiedad en la página. */
export async function updateRow(pageId: string, values: Record<string, unknown>) {
  const page = await notionApi(`pages/${plainId(pageId)}`);
  const dbId = page.parent?.database_id;
  if (!dbId) return;
  await notionApi(`pages/${plainId(pageId)}`, { method: 'PATCH', body: { properties: await buildProps(dbId, values) } });
}
