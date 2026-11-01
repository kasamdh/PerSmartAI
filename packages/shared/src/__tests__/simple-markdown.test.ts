import { parseInline, parseMarkdown } from '../simple-markdown.ts';

describe('parseMarkdown', () => {
  it('reads headings, paragraphs, lists and notes', () => {
    const blocks = parseMarkdown(
      [
        '# Privacy policy',
        '> **Draft** for a lawyer',
        '> to review.',
        '',
        'We collect',
        'very little.',
        '',
        '- Names and',
        '  email addresses',
        '- Photos',
        '## Contact',
      ].join('\n'),
    );
    expect(blocks).toEqual([
      { kind: 'heading', level: 1, content: [{ kind: 'text', text: 'Privacy policy' }] },
      {
        kind: 'note',
        content: [
          { kind: 'bold', text: 'Draft' },
          { kind: 'text', text: ' for a lawyer to review.' },
        ],
      },
      { kind: 'paragraph', content: [{ kind: 'text', text: 'We collect very little.' }] },
      {
        kind: 'list',
        items: [
          [{ kind: 'text', text: 'Names and email addresses' }],
          [{ kind: 'text', text: 'Photos' }],
        ],
      },
      { kind: 'heading', level: 2, content: [{ kind: 'text', text: 'Contact' }] },
    ]);
  });
});

describe('parseInline', () => {
  it('keeps safe links and turns anything else into text', () => {
    expect(parseInline('Email [us](mailto:a@b.co) or [x](javascript:alert(1))')).toEqual([
      { kind: 'text', text: 'Email ' },
      { kind: 'link', text: 'us', href: 'mailto:a@b.co' },
      { kind: 'text', text: ' or ' },
      { kind: 'text', text: 'x' },
      { kind: 'text', text: ')' },
    ]);
    expect(parseInline('See [terms](/terms).')).toContainEqual({
      kind: 'link',
      text: 'terms',
      href: '/terms',
    });
  });
});
