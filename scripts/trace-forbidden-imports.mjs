import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const roots = [
  'online-booking/account-runtime.js',
  'online-booking/user-entry.js',
  'core/account-transition-runtime.js',
  'core/password-reset-request.js',
  'core/chat/messenger-mode.js',
  'ui/inputs/keyboard-runtime.js',
].filter((rel) => fs.existsSync(path.join(root, rel)));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'scripts') return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(root).filter((file) => /\.(?:js|mjs)$/i.test(file));
const relative = (file) => path.relative(root, file).split(path.sep).join('/');
const fileSet = new Set(files.map(relative));

function specs(code) {
  const result = [];
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s*)?['"]([^'"]+)['"]\s*;?/g,
    /\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]\s*;?/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(code))) result.push(match[1]);
  }
  return result;
}

function resolve(importer, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
  for (const candidate of [base, `${base}.js`, `${base}.mjs`, `${base}/index.js`]) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

const graph = new Map();
for (const file of files) {
  const rel = relative(file);
  const code = fs.readFileSync(file, 'utf8');
  graph.set(rel, specs(code).map((specifier) => ({ specifier, target: resolve(rel, specifier) })).filter((row) => row.target));
}

const forbidden = (file) => file.startsWith('core/finance/');
const seen = new Set();
const queue = roots.map((rootFile) => ({ file: rootFile, chain: [rootFile] }));
let found = 0;
while (queue.length) {
  const { file, chain } = queue.shift();
  const stateKey = `${file}|${chain.slice(-3).join('>')}`;
  if (seen.has(stateKey)) continue;
  seen.add(stateKey);
  for (const edge of graph.get(file) || []) {
    const nextChain = [...chain, edge.target];
    if (forbidden(edge.target)) {
      found += 1;
      console.log(`FORBIDDEN ${nextChain.join(' -> ')}`);
      continue;
    }
    if (nextChain.length < 20 && !chain.includes(edge.target)) queue.push({ file: edge.target, chain: nextChain });
  }
}
console.log(`Forbidden chains: ${found}`);
