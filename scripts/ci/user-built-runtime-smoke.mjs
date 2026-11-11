// Exercise the *compiled* immutable production HTML/JS/CSS, not source files.
// The live staging gateway deliberately serves unbundled sources, so only a
// build-level browser test can prove that production bundles still boot.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('dist');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const revision = html.match(/\/assets\/([0-9a-f]{20})\//)?.[1];
assert.ok(revision, 'Production HTML must reference immutable content-versioned assets');
assert.equal((html.match(/<link\b[^>]*\brel="stylesheet"/g) || []).length, 1,
  'Production HTML must download exactly one ordered CSS bundle');
assert.ok(!html.includes("import('./user/main.js')"), 'Legacy module entry must not ship in compiled HTML');
assert.ok(!html.includes("import('./ui/inputs/keyboard-runtime.js')"),
  'Keyboard must use a compiled entry rather than 100 raw source files');

const mime = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const missing = [];
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
  const path = resolve(root, filename);
  if (path !== root && !path.startsWith(root + sep)) {
    res.writeHead(403); res.end(); return;
  }
  try {
    const bytes = await readFile(path);
    const immutable = pathname.startsWith('/assets/' + revision + '/');
    res.writeHead(200, {
      'Content-Type': mime[extname(path)] || 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(bytes);
  } catch {
    missing.push(pathname);
    res.writeHead(404); res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({
    serviceWorkers: 'block', viewport: { width: 390, height: 844 },
  });
  const browserErrors = [];
  const assetRequests = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('requestfailed', (request) => browserErrors.push(
    new URL(request.url()).pathname + ': ' + request.failure()?.errorText));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (/\.(?:js|css)$/.test(path)) assetRequests.push(path);
  });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.locator('[data-global-account-entry]').waitFor({ state: 'visible', timeout: 12_000 });
  assert.equal(await page.locator('.app-bootstrap').count(), 0,
    'Production bundle must leave the startup placeholder and show working login');
  assert.deepEqual(browserErrors, [], 'Compiled JavaScript failed: ' + browserErrors.join('; '));
  assert.deepEqual(missing, [], 'Missing compiled resource: ' + missing.join('; '));

  const cssRequests = assetRequests.filter((url) => url.endsWith('.css'));
  const jsRequests = assetRequests.filter((url) => url.endsWith('.js'));
  assert.equal(cssRequests.length, 1, 'First login should need one CSS file');
  assert.ok(jsRequests.length > 0, 'Compiled JavaScript must actually execute');
  assert.ok(assetRequests.every((url) => url.startsWith('/assets/' + revision + '/')),
    'First login must not fetch raw unversioned JS/CSS');
  assert.ok(jsRequests.length < 30,
    'First login unexpectedly downloads a large source module graph: ' + jsRequests.length);
  const styles = await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor);
  assert.ok(styles && styles !== 'rgba(0, 0, 0, 0)', 'Production CSS must apply');
  console.log('PASS: compiled User startup, 1 CSS, ' + jsRequests.length +
    ' JS bundles/chunks, 0 raw JS/CSS, no missing assets, correct version ' + revision);
  await page.close();
} finally {
  server.closeAllConnections();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
