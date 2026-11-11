// Deterministic ownership check for first-party User UI JavaScript.
// Follow literal static imports/re-exports and literal dynamic imports from the
// real index.html entrypoints. No duplicate parallel or orphan UI module should
// survive in the shipped source tree.
import path from 'node:path';
import { read, walk, assert, finish } from './guard-lib.mjs';

const modules = new Set(
  ['service-worker.js', ...['core', 'user', 'ui'].flatMap((root) => walk(root))]
    .filter((name) => name.endsWith('.js')),
);
const dependencyPattern = /\b(?:from\s+|import\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+)\1/g;

function localImports(file, source) {
  const dependencies = new Set();
  for (const match of source.matchAll(dependencyPattern)) {
    const spec = match[2].split(/[?#]/)[0];
    if (!spec.endsWith('.js')) continue;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
    dependencies.add(resolved);
  }
  return [...dependencies];
}
const references = new Map([...modules].map((file) => [file, localImports(file, read(file))]));
const entries = [
  ...localImports('index.html', read('index.html')),
  // Independently loaded native PWA entrypoint (not reached from the HTML).
  'service-worker.js',
];
const seen = new Set();
const missing = new Set();
const follow = (module) => {
  if (seen.has(module)) return;
  seen.add(module);
  if (!modules.has(module)) { missing.add(module); return; }
  for (const child of references.get(module) || []) follow(child);
};
for (const root of entries) follow(root);
assert(missing.size === 0, 'Unresolved User JS module dependencies: ' + [...missing].sort().join(', '));
const orphanUi = [...modules].filter((file) => file.startsWith('ui/') && !seen.has(file)).sort();
assert(orphanUi.length === 0, 'Unused UI JavaScript source still shipped: ' + orphanUi.join(', '));
console.log(`UI graph: ${[...modules].filter((file) => file.startsWith('ui/')).length - orphanUi.length} reachable UI JS modules, ${orphanUi.length} orphans`);
finish('UI graph');
