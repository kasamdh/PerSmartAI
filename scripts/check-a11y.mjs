// Screen reader check for the mobile app: every touchable has a role, every text
// field and switch has a label (a placeholder isn't one), and every image has a
// label or is marked decorative (accessible={false}). Parses the JSX with
// TypeScript. Components that spread props ({...rest}) are trusted to pass them.
//
//   node scripts/check-a11y.mjs        (part of npm run check)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.resolve('apps/mobile/package.json'));
const ts = require('typescript');

const ROOTS = ['apps/mobile/src', 'apps/mobile/app'];
const TOUCHABLES = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight']);
const LABELLED = new Set(['TextInput', 'Switch']);

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === '__tests__' ? [] : walk(p);
    return p.endsWith('.tsx') ? [p] : [];
  });

const problems = [];
for (const file of ROOTS.flatMap(walk)) {
  const sf = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      const attrs = node.attributes.properties;
      const names = new Set(attrs.filter(ts.isJsxAttribute).map((a) => a.name.getText(sf)));
      const spread = attrs.some(ts.isJsxSpreadAttribute);
      const label = [
        'accessibilityLabel',
        'aria-label',
        'accessibilityLabelledBy',
        'aria-labelledby',
      ].some((n) => names.has(n));
      const role = names.has('accessibilityRole') || names.has('role');
      let problem = null;
      if (TOUCHABLES.has(tag) && !role && !spread) problem = 'touchable without accessibilityRole';
      else if (LABELLED.has(tag) && !label && !spread)
        problem = `${tag} without accessibilityLabel`;
      else if (tag === 'Image' && !label && !names.has('accessible') && !names.has('alt'))
        problem = 'Image without accessibilityLabel (or accessible={false} if decorative)';
      if (problem) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        problems.push(`${file}:${line} ${problem}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (problems.length) {
  console.error(`Accessibility problems:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  'Every touchable has a role, every input a label, every image a label or is decorative.',
);
