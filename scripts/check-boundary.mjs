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
const forbiddenTopLevel = new Set(['app', 'journal', 'settings', 'timetable', 'chat']);
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
    if (entry.name === '.git' || entry.name === 'node_modules' || rel === 'scripts' || rel.startsWith('scripts/')) return [];
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

const accountEntry = fs.readFileSync(path.join(root, 'user/account.js'), 'utf8');
const userMain = fs.readFileSync(path.join(root, 'user/main.js'), 'utf8');
const accountApi = fs.readFileSync(path.join(root, 'core/account/index.js'), 'utf8');

if (/booking-targets/.test(accountEntry)) {
  throw new Error('User Auth/Journal startup must not import Booking targets');
}
if (/^\s*import\s+[^\n]*booking\/entry\.js/m.test(userMain)) {
  throw new Error('Booking runtime must not be a static User startup dependency');
}
if (!/import\(['"]\.\.\/booking\/entry\.js['"]\)/.test(userMain)) {
  throw new Error('Booking runtime must remain demand-loaded from explicit User booking action');
}
if (!/label:\s*['"]Телефон или email['"]/.test(accountEntry)) {
  throw new Error('User login must accept one phone-or-email identifier');
}
if (/getRememberedAccountEmail/.test(accountEntry) || /ACCOUNT_EMAIL_KEY/.test(accountApi)) {
  throw new Error('User login memory must not be email-only');
}
if (/if\s*\(identifier\)\s*\{\s*return\s*\{\s*exists:\s*true/s.test(accountApi)) {
  throw new Error('User account prepare must use the platform contract instead of assuming an identifier exists');
}

console.log('User boundary: PASS');
