// A CSS file is a unique shipped UI source, never a hidden parallel owner.
// Validate every first-party stylesheet, including nested @media/@container
// rules, without changing any approved visual declarations.
import { assert, read, walk, finish } from './guard-lib.mjs';

const html = read('index.html');
const stylesheets = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)]
  .map((match) => match[1]);
const files = [...walk('css'), ...walk('ui')].filter((file) => file.endsWith('.css')).sort();
assert(stylesheets.length === new Set(stylesheets).size, 'Duplicate stylesheet references');
assert(stylesheets.length === files.length, 'Orphan or missing CSS sources: ' +
  files.filter((file) => !stylesheets.includes(file)).join(', ') + ' | missing: ' +
  stylesheets.filter((file) => !files.includes(file)).join(', '));
for (const file of stylesheets) assert(files.includes(file), 'Missing stylesheet: ' + file);

// Match equivalent complete CSS rule declarations, retaining their enclosing
// @media/@supports/@container scope. Different declarations for the same
// selector are intentional cascade overrides, not duplicates.
const seen = new Map();
let duplicates = 0;
for (const file of files) {
  const source = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
  const stack = [];
  let segmentStart = 0;
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '{') {
      const head = source.slice(segmentStart, index).trim();
      if (stack.length) stack[stack.length - 1].nested = true;
      stack.push({ head, bodyStart: index + 1, nested: false });
      segmentStart = index + 1;
    } else if (source[index] === '}') {
      const item = stack.pop();
      if (!item) continue;
      const isKeyframe = stack.some((entry) => /^@(?:-\w+-)?keyframes\b/.test(entry.head));
      if (!item.nested && !item.head.startsWith('@') && !isKeyframe) {
        const scope = stack.filter((entry) => entry.head.startsWith('@'))
          .map((entry) => entry.head.replace(/\s+/g, ''));
        const selector = item.head.replace(/\s+/g, ' ').trim();
        const declarations = source.slice(item.bodyStart, index).replace(/\s+/g, '').trim();
        if (selector && declarations) {
          const signature = JSON.stringify([scope, selector, declarations]);
          const previous = seen.get(signature);
          if (previous) {
            duplicates++;
            assert(false, 'Duplicate exact CSS declaration in ' + previous + ' and ' + file + ': ' + selector);
          } else {
            seen.set(signature, file);
          }
        }
      }
      segmentStart = index + 1;
    }
  }
  assert(stack.length === 0, 'Unbalanced CSS blocks in ' + file);
}
assert((read('ui/inputs/inputs.css').match(/\.phone-input\{display:grid;grid-template-columns:60px minmax\(0,1fr\)/g) || []).length === 1,
  'Phone input width belongs to its one base control; no redundant responsive copy');
console.log('CSS owners: ' + files.length + ' active linked stylesheets, ' +
  seen.size + ' unique scoped rule declarations, ' + duplicates + ' duplicate rules');
finish('CSS owners');
