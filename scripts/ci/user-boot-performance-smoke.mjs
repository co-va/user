import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

// Real User module graph, but an intentionally blocked /account/records reply.
// A usable Journal must render before history arrives; it must not remount
// the whole shell after the response. No live customer data is involved.
const baseDir = process.cwd();
let releaseHistory;
let recordsRequested = 0;
const pendingHistory = new Promise((resolve) => { releaseHistory = resolve; });
const send = (res, data) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  if (path === '/__performance__') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"><main id="user-content"></main></div></body></html>');
    return;
  }
  if (path === '/account/me') return send(res, { id: 'perf-account', name: 'Тест', surname: 'Скорость' });
  if (path === '/account/platform-state') return send(res, { accepted: true, document: {} });
  if (path === '/account/records') {
    recordsRequested++;
    await pendingHistory;
    return send(res, [{ tenantId: 'perf-tenant', id: 'perf-record', date: '2026-11-11', from: '11:00', to: '12:00',
      procedures: [{ name: 'Тест' }], payment: { state: 'due' } }]);
  }
  if (path === '/account/contacts') return send(res, []);
  if (path === '/account/journal-hidden-records') return send(res, { items: [] });
  if (path === '/account/deleted-record-history') return send(res, { items: [] });
  if (path === '/account/service-unseen') return send(res, { items: [] });
  if (path.startsWith('/account/')) return send(res, []);
  const file = resolve(baseDir, '.' + decodeURIComponent(path));
  if (!file.startsWith(baseDir + sep)) { res.writeHead(403); res.end(); return; }
  try {
    const payload = await readFile(file);
    res.writeHead(200, { 'Content-Type': {
      '.js': 'text/javascript', '.mjs': 'text/javascript',
      '.css': 'text/css', '.svg': 'image/svg+xml',
    }[extname(file)] || 'application/octet-stream' });
    res.end(payload);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const pageUrl = 'http://127.0.0.1:' + server.address().port + '/__performance__';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    window.__USER_API_BASE__ = location.origin;
    localStorage.setItem('user.account.token', 'perf-only-token');
  });
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(() => {
    window.__perfRender = import('/user/app.js').then(({ renderUser }) =>
      renderUser(document.querySelector('#user-content')));
  });
  await page.locator('[data-account-journal-root]').waitFor({ state: 'attached', timeout: 12000 });
  const wasUnblocked = await page.evaluate(() =>
    Promise.race([
      window.__perfRender.then(() => true),
      new Promise((resolve) => window.setTimeout(() => resolve(false), 300)),
    ])
  );
  assert.equal(wasUnblocked, true, 'Journal must be usable before records finish');
  assert.ok(recordsRequested > 0, 'Journal must still request full records');
  const before = await page.evaluate(() => {
    window.__journalSurface = document.querySelector('[data-account-journal-root]');
    return Boolean(window.__journalSurface);
  });
  assert.ok(before);
  releaseHistory();
  await page.waitForFunction(() => document.querySelector('[data-account-journal-root]')
    && document.querySelector('[data-account-journal-root]') === window.__journalSurface
    && document.querySelector('[data-account-journal-root]')?.userJournalRefresh);
  assert.equal(await page.evaluate(() => window.__journalSurface.isConnected), true,
    'History hydration must not rebuild the whole Journal shell');
  assert.equal(recordsRequested, 1, 'History must be fetched only once');
  assert.deepEqual(errors, [], 'Runtime errors: ' + errors.join('; '));
  console.log('PASS: Journal first interaction precedes slow records; one API call, stable shell');
  await page.close();
} finally {
  releaseHistory();
  server.closeAllConnections();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
