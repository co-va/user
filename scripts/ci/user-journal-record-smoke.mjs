import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const index = await readFile(resolve(root, 'index.html'), 'utf8');
const links = [...index.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((match) => match[1]);
const fixture = '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  links.map((path) => '<link rel="stylesheet" href="/' + path + '">').join('') +
  '</head><body><div class="app-shell" id="app"></div></body></html>';
const types = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const hidden = new Set();
const changes = [];
const deleted = {
  id: 'notice-1', tenantId: 'tenant-one', recordId: 'removed-1',
  date: '2026-11-06', from: '16:00', body: 'Запись на 2026-11-06 в 16:00 удалена.',
  removedAt: '2026-11-06T17:00:00Z', read: true,
};
const sendJson = (res, data) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};
const server = createServer(async (req, res) => {
  const path = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  if (path === '/__journal_smoke__') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fixture);
    return;
  }
  if (path === '/account/deleted-record-history') return sendJson(res, { items: [deleted] });
  if (path === '/account/journal-hidden-records' && req.method === 'GET') {
    return sendJson(res, { items: [...hidden].map((key) => {
      const [tenantId, recordId] = JSON.parse(key);
      return { tenantId, recordId };
    }) });
  }
  if (path === '/account/journal-hidden-records' && req.method === 'POST') {
    let payload = '';
    for await (const part of req) payload += part;
    const input = JSON.parse(payload || '{}');
    hidden.add(JSON.stringify([input.tenantId, input.recordId]));
    changes.push({ method: req.method, path, tenantId: input.tenantId, recordId: input.recordId });
    return sendJson(res, { hidden: true, tenantId: input.tenantId, recordId: input.recordId });
  }
  if (path.startsWith('/account/')) return sendJson(res, []);
  const file = resolve(root, '.' + decodeURIComponent(path));
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const url = 'http://127.0.0.1:' + server.address().port + '/__journal_smoke__';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.on('pageerror', (error) => console.error('JOURNAL JS:', error.message));
  await page.addInitScript(() => {
    window.__USER_API_BASE__ = location.origin;
    localStorage.setItem('user.account.token', 'journal-test');
  });
  const sourceRecords = [
    { id: 'future-1', tenantId: 'tenant-one', date: '2026-11-07', from: '12:00', to: '15:00',
      procedures: [
        { id: 'cut', name: 'Стрижка-женская', cost: 4000 },
        { id: 'color', name: 'Окраска', cost: 14000 },
        { id: 'shatush', name: 'Шатуш', cost: 3000 },
      ], finance: { planTotal: 21000 }, payment: { state: 'due', due: 21000 } },
    { id: 'paid-1', tenantId: 'tenant-one', date: '2026-11-06', from: '10:00', to: '11:00',
      procedures: [{ id: 'cut', name: 'Стрижка', cost: 3000 }],
      finance: { planTotal: 3000 }, payment: { state: 'paid', paid: 3000, due: 0 } },
    { id: 'debt-1', tenantId: 'tenant-one', date: '2026-11-05', from: '10:00', to: '11:00',
      attendance: 'arrived', procedures: [{ id: 'cut', name: 'Укладка', cost: 4500 }],
      finance: { planTotal: 4500 }, payment: { state: 'debt', due: 4500 } },
  ];
  async function mount() {
    await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
    await page.evaluate(async (records) => {
      const [{ v2Shell }, { renderJournal }] = await Promise.all([
        import('/ui/v2/shell.js'), import('/user/journal.js'),
      ]);
      const host = document.querySelector('#app');
      host.innerHTML = v2Shell({
        header: '<header class="v2-header" data-v2-header>Журнал</header>',
        body: '<div data-journal-root></div>',
      });
      window.__records = records;
      window.__journalDispose = renderJournal(host.querySelector('[data-journal-root]'), {
        initialView: 'list', records: () => window.__records,
      });
    }, sourceRecords);
    await page.locator('.journal-list-record--active').first().waitFor({ timeout: 12_000 });
  }
  await mount();
  await page.locator('.journal-list-record--deleted').waitFor({ timeout: 12_000 });
  const actual = await page.evaluate(() => {
    const normal = [...document.querySelectorAll('.journal-list-record--active')]
      .find((row) => row.textContent.includes('Стрижка-женская'));
    const deleted = document.querySelector('.journal-list-record--deleted');
    const get = (node, css) => node?.querySelector(css)?.textContent?.trim() || '';
    return {
      normal: {
        title: get(normal, '.journal-record-label'),
        date: get(normal, '.journal-record-date'),
        services: get(normal, '.journal-record-procedures'),
        length: get(normal, '.journal-record-duration'),
        amount: get(normal, '.journal-record-total'),
        status: get(normal, '.journal-record-status--due'),
        rows: normal?.querySelectorAll('.list-entry__column-line').length,
      },
      deleted: {
        title: get(deleted, '.journal-record-label'),
        date: get(deleted, '.journal-record-date'),
        status: get(deleted, '.journal-record-status--deleted'),
        amount: get(deleted, '.journal-record-total'),
        rows: deleted?.querySelectorAll('.list-entry__column-line').length,
        text: deleted?.textContent || '',
        bg: getComputedStyle(deleted.querySelector('.list-entry__content')).backgroundColor,
      },
      paid: get(document.querySelector('.journal-list-record--paid'), '.journal-record-status--paid'),
      debt: get(document.querySelector('.journal-record-status--debt')?.closest('.journal-list-record'), '.journal-record-status--debt'),
    };
  });
  assert.equal(actual.normal.title, 'Запись');
  assert.equal(actual.normal.date, '07.11.26 · 12:00');
  assert.equal(actual.normal.services, 'Стрижка-женская · Окраска · Шатуш');
  assert.equal(actual.normal.length, '3 ч');
  assert.match(actual.normal.amount, /21\s?000\s?₽/);
  assert.equal(actual.normal.status, 'К оплате');
  assert.equal(actual.paid, 'Оплачено');
  assert.equal(actual.debt, 'Задолженность');
  assert.equal(actual.deleted.title, 'Запись');
  assert.equal(actual.deleted.date, '06.11.26 · 16:00');
  assert.equal(actual.deleted.status, 'Удалена');
  assert.equal(actual.deleted.amount, '');
  assert.equal(actual.deleted.text.includes('₽'), false);
  assert.equal(actual.deleted.bg, 'rgb(255, 255, 255)');
  assert.equal(actual.deleted.rows, actual.normal.rows);

  // A removed source record can be opened and repeated without inventing details.
  await page.locator('.journal-list-record--deleted').click();
  await page.locator('[data-user-record-repeat]').waitFor();
  await page.locator('[data-user-record-hide]').waitFor();
  await page.evaluate(() => {
    window.__repeat = null;
    window.addEventListener('cova:user-record-start', (event) => { window.__repeat = event.detail; }, { once: true });
  });
  await page.locator('[data-user-record-repeat]').click();
  const repeated = await page.evaluate(() => window.__repeat);
  assert.equal(repeated?.contactId, 'tenant-one');
  assert.equal(Boolean(repeated?.repeatRequest), false);

  await page.locator('.journal-list-record--deleted').click();
  await page.locator('[data-user-record-hide]').click();
  await page.locator('.journal-list-record--deleted').waitFor({ state: 'detached', timeout: 10_000 });
  assert.deepEqual(changes, [{ method: 'POST', path: '/account/journal-hidden-records',
    tenantId: 'tenant-one', recordId: 'removed-1' }]);
  assert.equal(sourceRecords.length, 3);
  await mount();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.journal-list-record--deleted').count(), 0,
    'Dismissed record must remain hidden after a reload');
  console.log('PASS: same card, date and duration, price/status, deleted no sum, repeat, persistent hide');
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
