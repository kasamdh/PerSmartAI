// A deliberately small Markdown reader for the legal pages (privacy policy,
// terms, account deletion), so they can be written as plain .md files that a
// lawyer can edit. Supports: # ## ### headings, paragraphs, "- " lists,
// "> " notes, **bold** and [links](https://...). Nothing else, and no HTML.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; href: string };

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; content: Inline[] }
  | { kind: 'paragraph'; content: Inline[] }
  | { kind: 'list'; items: Inline[][] }
  | { kind: 'note'; content: Inline[] };

const SAFE_HREF = /^(https?:\/\/|mailto:|\/)/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: 'bold', text: m[1] });
    else if (SAFE_HREF.test(m[3])) out.push({ kind: 'link', text: m[2], href: m[3] });
    else out.push({ kind: 'text', text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;
  let note: string[] = [];

  const flush = () => {
    if (paragraph.length)
      blocks.push({ kind: 'paragraph', content: parseInline(paragraph.join(' ')) });
    if (list) blocks.push({ kind: 'list', items: list.map(parseInline) });
    if (note.length) blocks.push({ kind: 'note', content: parseInline(note.join(' ')) });
    paragraph = [];
    list = null;
    note = [];
  };

  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        content: parseInline(heading[2]),
      });
    } else if (line.startsWith('- ')) {
      if (paragraph.length || note.length) flush();
      list = [...(list ?? []), line.slice(2)];
    } else if (line.startsWith('>')) {
      if (paragraph.length || list) flush();
      note.push(line.replace(/^>\s?/, ''));
    } else if (list) {
      // A wrapped list item continues the previous one.
      list[list.length - 1] += ` ${line}`;
    } else {
      if (note.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
