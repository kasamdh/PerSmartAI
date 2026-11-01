// Regenerates Supabase types into packages/shared/src/database.ts, then syncs the
// Edge Functions copy (scripts/sync-shared.mjs).
// Writes nothing if generation fails, so a DB hiccup can't clobber good types.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const target = 'packages/shared/src/database.ts';
let output;
try {
  output = execSync('npx supabase gen types typescript --local --schema public', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
} catch {
  console.error('Type generation failed; packages/shared/src/database.ts was left unchanged.');
  process.exit(1);
}
if (!output.includes('export type Database')) {
  console.error('Unexpected generator output; packages/shared/src/database.ts was left unchanged.');
  process.exit(1);
}
writeFileSync(target, output);
execSync(`npx prettier --write ${target}`, { stdio: 'ignore' });
execSync('node scripts/sync-shared.mjs', { stdio: 'inherit' });
console.log(`Wrote ${target}`);
