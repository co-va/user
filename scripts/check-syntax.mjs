import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.relative(root, path.join(dir, entry.name)).split(path.sep).join('/');
    if (entry.name === '.git' || entry.name === 'node_modules' || rel === 'scripts' || rel.startsWith('scripts/') || rel === '.github' || rel.startsWith('.github/')) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function resolveLocal(importer, specifier) {
  if (!specifier.startsWith('.')) return true;
  const base = path.resolve(path.dirname(importer), specifier);
  return [base, `${base}.js`, `${base}.mjs`, path.join(base, 'index.js')].some((candidate) => fs.existsSync(candidate));
}

const jsFiles = walk(root).filter((file) => /\.(?:js|mjs)$/i.test(file));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Syntax error in ${path.relative(root, file)}\n${result.stderr}`);
  const code = fs.readFileSync(file, 'utf8');
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s*)?['"]([^'"]+)['"]\s*;?/g,
    /\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]\s*;?/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(code))) {
      if (!resolveLocal(file, match[1])) throw new Error(`Missing local import ${match[1]} in ${path.relative(root, file)}`);
    }
  }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const value = match[1];
  if (!value || /^(?:https?:|data:|#)/i.test(value)) continue;
  const rel = value.replace(/^\//, '').split('?')[0].split('#')[0];
  if (!rel || rel === '/') continue;
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing index.html asset: ${rel}`);
}

console.log(`User syntax/dependencies: PASS (${jsFiles.length} JS files)`);
