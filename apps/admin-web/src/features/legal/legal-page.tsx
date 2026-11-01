import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parseMarkdown, type Block, type Inline } from '@petsitter/shared/simple-markdown';
import Link from 'next/link';

// Public legal pages (privacy, terms, account deletion). The text lives in
// docs/legal/*.md so it can be reviewed and edited as plain documents; pages are
// built at build time (force-static), so the files are read once.

export type LegalDoc = 'privacy-policy' | 'terms-of-service' | 'account-deletion';

export function readLegalDoc(doc: LegalDoc): Block[] {
  const file = path.join(process.cwd(), '..', '..', 'docs', 'legal', `${doc}.md`);
  return parseMarkdown(readFileSync(file, 'utf8'));
}

function Text({ content }: { content: Inline[] }) {
  return content.map((part, i) =>
    part.kind === 'bold' ? (
      <strong key={i}>{part.text}</strong>
    ) : part.kind === 'link' ? (
      part.href.startsWith('/') ? (
        <Link key={i} href={part.href} className="text-brand-ink underline">
          {part.text}
        </Link>
      ) : (
        <a key={i} href={part.href} className="text-brand-ink underline">
          {part.text}
        </a>
      )
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}

export function LegalPage({ blocks }: { blocks: Block[] }) {
  return (
    <main className="mx-auto max-w-3xl bg-white px-5 py-10 leading-relaxed text-gray-900 sm:my-8 sm:rounded-2xl sm:px-10 sm:shadow-sm">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return block.level === 1 ? (
              <h1 key={i} className="mb-4 text-3xl font-bold">
                <Text content={block.content} />
              </h1>
            ) : block.level === 2 ? (
              <h2 key={i} className="mt-8 mb-3 text-xl font-semibold">
                <Text content={block.content} />
              </h2>
            ) : (
              <h3 key={i} className="mt-5 mb-2 font-semibold">
                <Text content={block.content} />
              </h3>
            );
          case 'paragraph':
            return (
              <p key={i} className="my-3">
                <Text content={block.content} />
              </p>
            );
          case 'list':
            return (
              <ul key={i} className="my-3 list-disc space-y-2 pl-6">
                {block.items.map((item, j) => (
                  <li key={j}>
                    <Text content={item} />
                  </li>
                ))}
              </ul>
            );
          case 'note':
            return (
              <p
                key={i}
                role="note"
                className="my-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
              >
                <Text content={block.content} />
              </p>
            );
        }
      })}
      <nav className="mt-10 flex gap-4 border-t border-gray-200 pt-4 text-sm">
        <Link href="/privacy" className="text-brand-ink underline">
          Privacy policy
        </Link>
        <Link href="/terms" className="text-brand-ink underline">
          Terms of service
        </Link>
        <Link href="/account-deletion" className="text-brand-ink underline">
          Delete your account
        </Link>
      </nav>
    </main>
  );
}
