// Copies the Deno-safe part of packages/shared into supabase/functions/_shared.
//
// packages/shared is the single source. The local Edge Functions runtime only
// sees supabase/functions, so the functions get generated copies. Run after
// changing those files; `--check` (part of `npm run check`) fails if a copy is stale.

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SOURCE = 'packages/shared/src';
const TARGET = 'supabase/functions/_shared';
// Only files whose imports are relative `.ts` paths among themselves (or rrule,
// which each function maps in its deno.json).
const FILES = [
  'database.ts',
  'alerts.ts',
  'chat-alerts.ts',
  'push-messages.ts',
  ...readdirSync(path.join(SOURCE, 'scheduling'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `scheduling/${f}`),
];

const header = (file) =>
  `// GENERATED from packages/shared/src/${file} by scripts/sync-shared.mjs. Do not edit;\n// change the source and run \`npm run shared:sync\`.\n\n`;

const check = process.argv.includes('--check');
const stale = [];
for (const file of FILES) {
  const expected = header(file) + readFileSync(path.join(SOURCE, file), 'utf8');
  const target = path.join(TARGET, file);
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  if (current === expected) continue;
  if (check) {
    stale.push(target);
  } else {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, expected);
    console.log(`wrote ${target}`);
  }
}

if (check && stale.length) {
  console.error(`Out of date (run npm run shared:sync):\n  ${stale.join('\n  ')}`);
  process.exit(1);
}
if (check) console.log(`supabase/functions/_shared is in sync (${FILES.length} files).`);
