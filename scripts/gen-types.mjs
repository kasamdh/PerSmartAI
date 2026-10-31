// Regenerates Supabase types into src/types/database.ts (and the Edge Functions copy).
// Writes nothing if generation fails, so a DB hiccup can't clobber good types.
import { execSync } from 'node:child_process';
import { copyFileSync, writeFileSync } from 'node:fs';

const target = 'src/types/database.ts';
let output;
try {
  output = execSync('npx supabase gen types typescript --local --schema public', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
} catch {
  console.error('Type generation failed; src/types/database.ts was left unchanged.');
  process.exit(1);
}
if (!output.includes('export type Database')) {
  console.error('Unexpected generator output; src/types/database.ts was left unchanged.');
  process.exit(1);
}
writeFileSync(target, output);
execSync(`npx prettier --write ${target}`, { stdio: 'ignore' });
copyFileSync(target, 'supabase/functions/_shared/database.ts');
console.log(`Wrote ${target} and supabase/functions/_shared/database.ts`);
