import fs from 'node:fs';
import path from 'node:path';

export const ROOT = process.cwd();

export function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

export function assert(condition, message) {
  if (!condition) {
    console.error(`CI GUARD: ${message}`);
    process.exitCode = 1;
  }
}

export function count(text, needle) {
  if (!needle) return 0;
  return text.split(needle).length - 1;
}

export function changedFiles() {
  const source = process.argv[2];
  if (!source || !fs.existsSync(source)) return [];
  return fs.readFileSync(source, 'utf8').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

export function relevant(changed, prefixes = []) {
  if (!changed.length) return true;
  return changed.some((file) => prefixes.some((prefix) => file === prefix || file.startsWith(prefix)));
}

export function walk(relativePath) {
  const base = path.join(ROOT, relativePath);
  if (!fs.existsSync(base)) return [];
  const out = [];
  const visit = (absolute) => {
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const full = path.join(absolute, entry.name);
      if (entry.isDirectory()) visit(full);
      else out.push(path.relative(ROOT, full).replaceAll(path.sep, '/'));
    }
  };
  visit(base);
  return out;
}

export function textFiles() {
  const roots = ['core', 'user', 'ui', 'css'];
  const files = roots.flatMap(walk);
  for (const file of ['index.html', 'manifest.webmanifest', 'service-worker.js', 'nginx.conf']) {
    if (fs.existsSync(path.join(ROOT, file))) files.push(file);
  }
  return files.filter((file) => /\.(?:js|mjs|css|html|json|webmanifest|conf)$/.test(file));
}

export function finish(label) {
  if (process.exitCode) process.exit(process.exitCode);
  console.log(`${label}: PASS`);
}
