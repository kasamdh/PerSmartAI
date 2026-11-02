// Keeps colors in the design system (apps/mobile/src/theme).
//
// - Design-system code (TOKENS_ONLY) may not hard-code any color.
// - Older screens may not add new ones: the total must stay at or below
//   LEGACY_LIMIT. Lower the limit whenever you move a screen to tokens; at 0, turn
//   on dark mode (FOLLOW_PHONE_APPEARANCE in src/theme/theme-provider.tsx).
//
//   node scripts/check-design-tokens.mjs        (part of npm run check)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const LEGACY_LIMIT = 515;

const ROOTS = ['apps/mobile/src', 'apps/mobile/app'];
const SKIP_DIRS = new Set(['__tests__', 'theme']);
const TOKENS_ONLY = [
  'apps/mobile/src/components/ui/',
  'apps/mobile/src/features/owner/owner-home',
  'apps/mobile/src/features/design-preview/',
  'apps/mobile/app/design-preview.tsx',
];
// Hex colors (#RGB, #RRGGBB, #RRGGBBAA) and rgb()/rgba().
const COLOR = /#[0-9A-Fa-f]{3,8}\b|rgba?\(/g;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return SKIP_DIRS.has(name) ? [] : walk(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });

const problems = [];
let legacy = 0;
for (const file of ROOTS.flatMap(walk)) {
  const rel = file.split(path.sep).join('/');
  const count = (readFileSync(file, 'utf8').match(COLOR) ?? []).length;
  if (!count) continue;
  if (TOKENS_ONLY.some((prefix) => rel.startsWith(prefix))) {
    problems.push(`${rel}: ${count} hard-coded color(s); use theme colors (useTheme)`);
  } else {
    legacy += count;
  }
}

if (legacy > LEGACY_LIMIT) {
  problems.push(
    `${legacy} hard-coded colors in screens (limit ${LEGACY_LIMIT}). New code must use theme colors.`,
  );
}
if (problems.length) {
  console.error(`Design token problems:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `Design tokens OK. ${legacy} hard-coded colors left in older screens` +
    (legacy < LEGACY_LIMIT ? ` (lower LEGACY_LIMIT to ${legacy})` : '') +
    '.',
);
