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
