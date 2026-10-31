import fs from 'node:fs';
import path from 'node:path';

const targetRoot = process.cwd();
const sourceRoot = path.resolve(process.argv[2] || 'source');

function posix(value) {
  return value.split(path.sep).join('/');
}

function exists(rel) {
  return fs.existsSync(path.join(sourceRoot, rel));
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readSource(rel) {
  return fs.readFileSync(path.join(sourceRoot, rel), 'utf8');
}

function writeTarget(rel, content) {
  const file = path.join(targetRoot, rel);
  ensureDir(file);
  fs.writeFileSync(file, content);
}

function copySource(rel, targetRel = rel) {
  const source = path.join(sourceRoot, rel);
  if (!fs.existsSync(source)) throw new Error(`Missing source file: ${rel}`);
  const target = path.join(targetRoot, targetRel);
  ensureDir(target);
  fs.copyFileSync(source, target);
}

function removeTarget(rel) {
  fs.rmSync(path.join(targetRoot, rel), { recursive: true, force: true });
}

function resolveLocal(importer, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = posix(path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier)));
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}/index.js`];
  for (const candidate of candidates) {
    if (exists(candidate) && fs.statSync(path.join(sourceRoot, candidate)).isFile()) return candidate;
  }
  throw new Error(`Cannot resolve ${specifier} from ${importer}`);
}

function relativeSpecifier(importer, target) {
  let rel = path.posix.relative(path.posix.dirname(importer), target);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function parseNamedImports(code) {
  const rows = [];
  const regex = /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g;
  let match;
  while ((match = regex.exec(code))) {
    const names = match[1]
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.split(/\s+as\s+/)[0].trim());
    rows.push({ full: match[0], names, specifier: match[2] });
  }
  return rows;
}

function dependencySpecifiers(code) {
  const specs = new Set();
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s*)?['"]([^'"]+)['"]\s*;?/g,
    /\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]\s*;?/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(code))) specs.add(match[1]);
  }
  return [...specs];
}

function localAssetSpecifiers(code) {
  const specs = new Set();
  const patterns = [
    /new\s+URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
    /fetch\(\s*['"](\.{1,2}\/[^'"]+)['"]/g,
  ];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(code))) specs.add(match[1]);
  }
  return [...specs];
}

function buildUiSymbolMap() {
  const code = readSource('ui/ui.js');
  const map = new Map();
  for (const row of parseNamedImports(code)) {
    for (const name of row.names) map.set(name, row.specifier);
  }
  return map;
}

for (const rel of ['core', 'online-booking', 'ui', 'css', 'index.html', 'service-worker.js', 'manifest.webmanifest', 'app-icon.svg', 'Dockerfile', 'nginx.conf', 'amvera.yml', 'package.json']) {
  removeTarget(rel);
}

let html = readSource('user.html');
html = html.replace(/\n\s*<link rel="apple-touch-icon"[^>]*icon-192\.png[^>]*>/i, '');
writeTarget('index.html', html);
copySource('service-worker.js');
copySource('pwa/user/app-icon.svg', 'app-icon.svg');

const manifest = JSON.parse(readSource('pwa/user/manifest.webmanifest'));
manifest.icons = (Array.isArray(manifest.icons) ? manifest.icons : []).filter((icon) => String(icon?.src || '') !== '/icon-192.png');
writeTarget('manifest.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);

const uiSymbolMap = buildUiSymbolMap();
const requestedUiSymbols = new Set();
const copiedJs = new Set();
const queued = [];

for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi)) {
  const src = match[1].replace(/^\//, '');
  if (src && !/^https?:/i.test(src)) queued.push(src);
}

function queueModule(rel) {
  if (!copiedJs.has(rel) && !queued.includes(rel)) queued.push(rel);
}

function rewriteUiAggregator(importer, code) {
  let output = code;
  for (const row of parseNamedImports(code)) {
    const resolved = resolveLocal(importer, row.specifier);
    if (resolved !== 'ui/ui.js') continue;
    for (const name of row.names) requestedUiSymbols.add(name);
    const replacement = row.full.replace(row.specifier, relativeSpecifier(importer, 'ui/user-ui.js'));
    output = output.replace(row.full, replacement);
  }
  return output;
}

while (queued.length) {
  const rel = queued.shift();
  if (copiedJs.has(rel)) continue;
  if (!exists(rel)) throw new Error(`Missing JS dependency: ${rel}`);
  let code = readSource(rel);
  code = rewriteUiAggregator(rel, code);
  writeTarget(rel, code);
  copiedJs.add(rel);

  for (const specifier of dependencySpecifiers(code)) {
    const resolved = resolveLocal(rel, specifier);
    if (!resolved || resolved === 'ui/user-ui.js') continue;
    if (resolved === 'ui/ui.js') throw new Error(`Unrewritten ui/ui.js import in ${rel}`);
    queueModule(resolved);
  }

  for (const specifier of localAssetSpecifiers(code)) {
    const base = posix(path.posix.normalize(path.posix.join(path.posix.dirname(rel), specifier)));
    if (exists(base) && fs.statSync(path.join(sourceRoot, base)).isFile()) copySource(base);
  }
}

const byModule = new Map();
for (const symbol of [...requestedUiSymbols].sort()) {
  const specifier = uiSymbolMap.get(symbol);
  if (!specifier) throw new Error(`No ui/ui.js source mapping for ${symbol}`);
  const moduleRel = resolveLocal('ui/ui.js', specifier);
  if (!byModule.has(moduleRel)) byModule.set(moduleRel, []);
  byModule.get(moduleRel).push(symbol);
  queueModule(moduleRel);
}

let userUi = "import { installAppModeSwitch } from './header/mode-switch.js';\n\ninstallAppModeSwitch();\n\n";
for (const [moduleRel, names] of [...byModule.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const specifier = relativeSpecifier('ui/user-ui.js', moduleRel);
  userUi += `export { ${names.sort().join(', ')} } from '${specifier}';\n`;
}
writeTarget('ui/user-ui.js', userUi);
queueModule('ui/header/mode-switch.js');

while (queued.length) {
  const rel = queued.shift();
  if (copiedJs.has(rel)) continue;
  if (!exists(rel)) throw new Error(`Missing JS dependency: ${rel}`);
  let code = readSource(rel);
  code = rewriteUiAggregator(rel, code);
  writeTarget(rel, code);
  copiedJs.add(rel);
  for (const specifier of dependencySpecifiers(code)) {
    const resolved = resolveLocal(rel, specifier);
    if (!resolved || resolved === 'ui/user-ui.js') continue;
    if (resolved === 'ui/ui.js') throw new Error(`Unrewritten ui/ui.js import in ${rel}`);
    queueModule(resolved);
  }
}

const copiedCss = new Set();
const cssQueue = [];
for (const match of html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/gi)) {
  const href = match[1].replace(/^\//, '');
  if (href && !/^https?:/i.test(href)) cssQueue.push(href);
}

while (cssQueue.length) {
  const rel = cssQueue.shift();
  if (copiedCss.has(rel)) continue;
  if (!exists(rel)) throw new Error(`Missing CSS dependency: ${rel}`);
  const code = readSource(rel);
  writeTarget(rel, code);
  copiedCss.add(rel);

  for (const match of code.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?/g)) {
    const specifier = match[1];
    if (/^(?:https?:|data:|\/)/i.test(specifier)) continue;
    const resolved = posix(path.posix.normalize(path.posix.join(path.posix.dirname(rel), specifier)));
    if (!copiedCss.has(resolved)) cssQueue.push(resolved);
  }
  for (const match of code.matchAll(/url\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^['"]|['"]$/g, '').split('#')[0].split('?')[0];
    if (!raw || /^(?:https?:|data:|\/)/i.test(raw) || raw.endsWith('.css')) continue;
    const resolved = posix(path.posix.normalize(path.posix.join(path.posix.dirname(rel), raw)));
    if (exists(resolved) && fs.statSync(path.join(sourceRoot, resolved)).isFile()) copySource(resolved);
  }
}

const forbidden = [
  'server/',
  'admin/',
  'landing/',
  'core/finance/',
];
for (const prefix of forbidden) {
  if (fs.existsSync(path.join(targetRoot, prefix))) throw new Error(`Forbidden User path copied: ${prefix}`);
}
if (fs.existsSync(path.join(targetRoot, 'ui/ui.js'))) throw new Error('Global ui/ui.js must not exist in User');
if (fs.existsSync(path.join(targetRoot, 'booking.html'))) throw new Error('Public Booking entry must not exist in User');

writeTarget('package.json', `${JSON.stringify({
  name: '@co-va/user',
  private: true,
  type: 'module',
  scripts: {
    check: 'node scripts/check-boundary.mjs && node scripts/check-syntax.mjs',
  },
}, null, 2)}\n`);

writeTarget('Dockerfile', `FROM nginx:1.27-alpine\n\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\nCOPY index.html /usr/share/nginx/html/index.html\nCOPY service-worker.js /usr/share/nginx/html/service-worker.js\nCOPY manifest.webmanifest /usr/share/nginx/html/manifest.webmanifest\nCOPY app-icon.svg /usr/share/nginx/html/app-icon.svg\nCOPY css /usr/share/nginx/html/css\nCOPY core /usr/share/nginx/html/core\nCOPY online-booking /usr/share/nginx/html/online-booking\nCOPY ui /usr/share/nginx/html/ui\n\nEXPOSE 3000\n`);
writeTarget('nginx.conf', `server {\n  listen 3000;\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n\n  location = /service-worker.js {\n    add_header Cache-Control \"no-cache\";\n    try_files $uri =404;\n  }\n}\n`);
writeTarget('amvera.yml', `meta:\n  environment: docker\n  toolchain:\n    name: docker\nbuild:\n  dockerfile: Dockerfile\n  skip: false\nrun:\n  containerPort: 3000\n`);

console.log(`User extraction complete: ${copiedJs.size} JS modules, ${copiedCss.size} CSS files, ${requestedUiSymbols.size} UI exports.`);
