// Fails if a built client bundle contains anything secret: a Supabase JWT whose
// role isn't `anon`, a new-style secret key, or a known token format.
//
//   node scripts/check-bundle-secrets.mjs <dir|file> [...]
//
// CI runs it on the admin web's .next/static and a `expo export --no-bytecode`
// of the mobile app.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// Secrets appear in JS as string literals, so each must follow a quote or
// separator. That also keeps them from matching across identifiers.
const START = String.raw`(?<=["'${'`'}=:\s,(])`;
const PATTERNS = [
  ['Supabase secret key', new RegExp(START + String.raw`sb_secret_[A-Za-z0-9_-]{20,}`, 'g')],
  ['Sentry auth token', new RegExp(START + String.raw`sntrys_[A-Za-z0-9_=+/-]{20,}`, 'g')],
  ['PostHog personal API key', new RegExp(START + String.raw`phx_[A-Za-z0-9]{30,}`, 'g')],
  ['GitHub token', new RegExp(START + String.raw`gh[pousr]_[A-Za-z0-9]{30,}`, 'g')],
  ['AWS access key', new RegExp(START + String.raw`AKIA[0-9A-Z]{16}(?![0-9A-Z])`, 'g')],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const TEXT = /\.(js|mjs|cjs|map|json|html|hbc|txt)$/;

function* files(target) {
  if (!statSync(target).isDirectory()) {
    yield target;
    return;
  }
  for (const entry of readdirSync(target)) {
    const full = path.join(target, entry);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (TEXT.test(entry)) yield full;
  }
}

function jwtRole(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')).role ?? '(none)';
  } catch {
    return null; // not actually a JWT
  }
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('Usage: node scripts/check-bundle-secrets.mjs <dir|file> [...]');
  process.exit(2);
}

const problems = [];
let scanned = 0;
for (const target of targets) {
  for (const file of files(target)) {
    scanned++;
    const text = readFileSync(file, 'latin1');
    // Hermes bytecode stores strings back to back, so only JWTs (checked by
    // decoding) are reliable there.
    for (const [name, pattern] of file.endsWith('.hbc') ? [] : PATTERNS) {
      if (pattern.test(text)) problems.push(`${file}: ${name}`);
      pattern.lastIndex = 0;
    }
    for (const token of new Set(text.match(JWT) ?? [])) {
      const role = jwtRole(token);
      if (role !== null && role !== 'anon') problems.push(`${file}: JWT with role "${role}"`);
    }
  }
}

if (problems.length) {
  console.error(`Secrets found in client bundles:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`No secrets in ${scanned} bundle files.`);
