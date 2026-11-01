// Type-checks every Edge Function with Deno (they're outside the workspaces' tsc).
// Uses each function's deno.json when it has one. Needs Deno, or runs it via npx.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = 'supabase/functions';
const deno = process.env.DENO_BIN ?? 'deno';
const functions = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
  .map((e) => e.name);

let failed = 0;
for (const name of functions) {
  const dir = path.join(root, name);
  const config = path.join(dir, 'deno.json');
  const args = ['check', ...(existsSync(config) ? ['--config', config] : ['--no-config'])];
  try {
    execFileSync(deno, [...args, path.join(dir, 'index.ts')], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    console.log(`ok ${name}`);
  } catch {
    failed++;
    console.error(`FAILED ${name}`);
  }
}
process.exit(failed ? 1 : 0);
