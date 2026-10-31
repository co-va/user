import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbiddenPaths = [
  'server',
  'admin',
  'landing',
  'core/finance',
  'core/business-persistence.js',
  'core/day',
  'core/people',
  'core/record/index.js',
  'core/event/index.js',
  'core/note/index.js',
  'booking.html',
  'ui/ui.js',
];
const forbiddenTopLevel = new Set(['journal', 'settings', 'timetable', 'chat']);

for (const rel of forbiddenPaths) {
  if (fs.existsSync(path.join(root, rel))) throw new Error(`Forbidden User path: ${rel}`);
}
for (const name of forbiddenTopLevel) {
  if (fs.existsSync(path.join(root, name))) throw new Error(`Unexpected top-level contour in User: ${name}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.relative(root, path.join(dir, entry.name)).split(path.sep).join('/');
    if (entry.name === '.git' || entry.name === 'node_modules' || rel === 'scripts' || rel.startsWith('scripts/')) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

for (const file of walk(root)) {
  if (!/\.(?:js|mjs|html)$/i.test(file)) continue;
  const code = fs.readFileSync(file, 'utf8');
  if (/['"][^'"]*ui\/ui\.js['"]/.test(code)) {
    throw new Error(`Global ui/ui.js reference is forbidden: ${path.relative(root, file)}`);
  }
}

console.log('User boundary: PASS');
