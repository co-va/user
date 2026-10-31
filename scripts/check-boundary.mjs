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
  'core/workplace-time.js',
  'core/time/availability.js',
  'core/record/index.js',
  'core/event/index.js',
  'core/note/index.js',
  'core/chat/internal-chat.js',
  'core/chat/message-actions.js',
  'core/chat/messenger-api.js',
  'core/chat/messenger-mode.js',
  'core/chat/unread-runtime.js',
  'ui/chat',
  'booking.html',
  'ui/ui.js',
];
const forbiddenTopLevel = new Set(['journal', 'settings', 'timetable', 'chat']);
const legacyToken = String.fromCharCode(98, 111, 111, 107);
const legacyTokenPattern = new RegExp(`(^|[^a-z0-9])${legacyToken}([^a-z0-9]|$)`, 'i');
const textFilePattern = /(?:\.(?:js|mjs|html|css|json|md|ya?ml|conf|sh|webmanifest|txt)|Dockerfile)$/i;

for (const rel of forbiddenPaths) {
  if (fs.existsSync(path.join(root, rel))) throw new Error(`Forbidden User path: ${rel}`);
}
for (const name of forbiddenTopLevel) {
  if (fs.existsSync(path.join(root, name))) throw new Error(`Unexpected top-level contour in User: ${name}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.relative(root, path.join(dir, entry.name)).split(path.sep).join('/');
    if (entry.name === '.git' || entry.name === 'node_modules') return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

for (const file of walk(root)) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  if (legacyTokenPattern.test(rel)) {
    throw new Error(`Forbidden legacy product name in path: ${rel}`);
  }
  if (!textFilePattern.test(file)) continue;
  const code = fs.readFileSync(file, 'utf8');
  if (legacyTokenPattern.test(code)) {
    throw new Error(`Forbidden legacy product name in file: ${rel}`);
  }
  if (/['"][^'"]*ui\/ui\.js['"]/.test(code)) {
    throw new Error(`Global ui/ui.js reference is forbidden: ${rel}`);
  }
}

console.log('User boundary: PASS');
