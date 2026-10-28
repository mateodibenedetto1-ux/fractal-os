import { Marked } from 'marked';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    // Nunca renderizamos HTML crudo que venga en el markdown
    html: ({ text }) => esc(text),
    link({ href, text }) {
      const safe = /^(https?:|mailto:|\/)/.test(href) ? href : '#';
      return `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

export function renderMarkdown(md: string): string {
  return marked.parse(md ?? '', { async: false }) as string;
}
