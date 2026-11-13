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
const deleted = {
  id: 'notice-1', tenantId: 'tenant-one', recordId: 'removed-1',
  date: '2026-11-06', from: '16:00', to: '19:00',
  procedures: [
    { id: 'cut', name: 'Стрижка-женская', duration: 60 },
    { id: 'color', name: 'Окраска', duration: 90 },
    { id: 'shatush', name: 'Шатуш', duration: 30 },
  ],
  body: 'Запись на 2026-11-06 в 16:00 удалена.',
  removedAt: '2026-11-06T17:00:00Z', read: true,
};
const accountEvents = [
  { id: 'event-gray', date: '2026-10-26', from: '11:00', to: '18:30', title: 'Рабочее событие', color: '#777A7D' },
  { id: 'event-yellow', date: '2026-10-27', from: '09:30', to: '10:00', title: 'Консультация', color: '#FFFF00' },
];
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
  if (path === '/account/events') return sendJson(res, accountEvents);
  if (path === '/account/journal-hidden-records' && req.method === 'GET') {
    return sendJson(res, { items: [...hidden].map((key) => {
      const [tenantId, recordId] = JSON.parse(key);
      return { tenantId, recordId };
    }) });
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
const watchdog = setTimeout(() => {
  console.error('FAIL: Journal browser fixture exceeded 45 seconds');
  process.exit(1);
}, 45_000);

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(6_000);
  page.setDefaultNavigationTimeout(15_000);
  page.on('console', (message) => {
    if (message.type() === 'error') console.error('JOURNAL CONSOLE:', message.text());
  });
  page.on('pageerror', (error) => console.error('JOURNAL JS:', error.message));
  await page.addInitScript(() => {
    window.__USER_API_BASE__ = location.origin;
    localStorage.setItem('user.account.token', 'journal-test');
  });
  const sourceRecords = [
    { id: 'future-1', tenantId: 'tenant-one', workplaceName: 'Бьюти тория', date: '2026-11-07', from: '12:00', to: '15:00',
      procedures: [
        { id: 'cut', name: 'Стрижка-женская', cost: 4000 },
        { id: 'color', name: 'Окраска', cost: 14000 },
        { id: 'shatush', name: 'Шатуш', cost: 3000 },
      ], finance: { planTotal: 21000 }, payment: { state: 'due', due: 21000 } },
    { id: 'paid-1', tenantId: 'tenant-one', workplaceName: 'Бьюти тория', date: '2026-11-06', from: '10:00', to: '11:00',
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
  console.log('JOURNAL FIXTURE: rendered active records');
  await page.locator('.journal-list-record--deleted').waitFor({ timeout: 6_000 });
  console.log('JOURNAL FIXTURE: rendered deleted record');
  await page.locator('.journal-list-event').first().waitFor({ timeout: 6_000 });
  console.log('JOURNAL FIXTURE: rendered colored events');

  // Visual contract: the approved Day/Month/List selector must not degrade
  // into independently rounded native buttons when a CSS file is removed.
  // WLIST2 also must retain the card-like ListEntry surface and shadow.
  const appearance = await page.evaluate(() => {
    const nav = document.querySelector('[data-view-navigation]');
    const active = nav?.querySelector('[data-view].is-active');
    const inactive = nav?.querySelector('[data-view]:not(.is-active)');
    const entry = document.querySelector('[data-user-journal-view] .list-entries .list-entry');
    if (!nav || !active || !inactive || !entry) return null;
    return {
      display: getComputedStyle(nav).display,
      borderWidth: getComputedStyle(nav).borderTopWidth,
      activeFill: getComputedStyle(active).backgroundColor,
      inactiveFill: getComputedStyle(inactive).backgroundColor,
      listShadow: getComputedStyle(entry).boxShadow,
      listMinHeight: parseFloat(getComputedStyle(entry).minHeight),
      listPosition: getComputedStyle(entry).position,
    };
  });
  assert.ok(appearance, 'Journal must render approved navigation and WLIST2');
  assert.equal(appearance.display, 'flex', 'Day/Month/List must use Shared segment layout');
  assert.equal(appearance.borderWidth, '1px', 'Day/Month/List must keep its approved outline');
  assert.notEqual(appearance.activeFill, appearance.inactiveFill,
    'Journal active selector must keep its Shared active fill');
  assert.notEqual(appearance.listShadow, 'none', 'WLIST2 must retain its approved shadow');
  assert.ok(appearance.listMinHeight >= 78 && appearance.listPosition === 'relative',
    'WLIST2 must retain its card geometry rather than flattening into plain rows');
  console.log('PASS: approved Day/Month/List and WLIST2 appearance');
  // Unread belongs to List navigation, not a Day/Month banner or second modal.
  await page.evaluate(() => {
    window.__VA_TOOLS_SERVICE_UNSEEN__ = {
      total: 1, items: [{
        id: 'unseen-1', tenantId: 'tenant-one', entityType: 'record',
        type: 'booking.deleted', recordIds: ['removed-1'], date: '2026-11-06',
      }],
    };
    window.dispatchEvent(new CustomEvent('va-tools:service-unseen'));
  });
  const listTab = page.locator('[data-v2-z-header-row="0"] [data-view="list"]');
  await page.waitForFunction(() => document.querySelector('[data-v2-z-header-row="0"] [data-view="list"]')?.classList.contains('has-notification'));
  assert.equal(await listTab.getAttribute('aria-label'), 'Список, есть изменения');
  assert.equal(await page.locator('[data-user-journal-notices-host]').count(), 0);
  assert.equal(await page.getByText('Изменения в записях', { exact: false }).count(), 0);
  await page.locator('[data-v2-z-header-row="0"] [data-view="day"]').click();
  await page.locator('.time-timeline').waitFor({timeout:6000});
  const journalSurfaces=await page.evaluate(()=>({
    z:getComputedStyle(document.querySelector('.v2-z')).backgroundColor,
    journal:getComputedStyle(document.querySelector('.time-timeline')).backgroundColor,
  }));
  assert.deepEqual(journalSurfaces,{z:'rgb(245, 245, 243)',journal:'rgb(255, 255, 255)'},
    'Z must be warm; the striped Journal time grid must remain white');
  assert.equal(await page.locator('[data-user-journal-notices-host]').count(), 0);
  assert.equal(await page.locator('[data-v2-z-header-row="0"] [data-view="day"].has-notification').count(), 0);
  assert.equal(await page.locator('[data-v2-z-header-row="0"] [data-view="list"].has-notification').count(), 1);
  await page.locator('[data-v2-z-header-row="0"] [data-view="month"]').click();
  assert.equal(await page.locator('[data-user-journal-notices-host]').count(), 0);
  assert.equal(await page.locator('[data-v2-z-header-row="0"] [data-view="list"].has-notification').count(), 1);
  await page.locator('[data-v2-z-header-row="0"] [data-view="list"]').click();
  await page.locator('.journal-list-record--deleted').waitFor();
  // Deletion history remains visible when the List layout changes; no re-fetch flicker.
  await page.locator('[data-v2-z-header-row="1"] [data-view="time"]').click();
  assert.equal(await page.locator('.journal-list-record--deleted').count(), 1);
  await page.locator('[data-v2-z-header-row="1"] [data-view="flow"]').click();
  assert.equal(await page.locator('.journal-list-record--deleted').count(), 1);
  console.log('PASS: unread dot belongs to List only; deleted entries persist across List modes');


  // The shared Z Header must keep the first list row clear of its controls.
  const navGap = await page.evaluate(() => {
    const tabs = document.querySelector('[data-v2-z-header-row="1"] [data-view-navigation]');
    const firstEntry = document.querySelector('[data-user-journal-view] .list-entries .list-entry');
    if (!tabs || !firstEntry) return null;
    return firstEntry.getBoundingClientRect().top - tabs.getBoundingClientRect().bottom;
  });
  assert.ok(navGap != null && navGap >= 10,
    `Journal list overlaps the shared Z navigation (gap: ${navGap})`);
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
        services: get(deleted, '.journal-record-procedures'),
        length: get(deleted, '.journal-record-duration'),
        status: get(deleted, '.journal-record-status--deleted'),
        amount: get(deleted, '.journal-record-total'),
        rows: deleted?.querySelectorAll('.list-entry__column-line').length,
        text: deleted?.textContent || '',
        bg: getComputedStyle(deleted.querySelector('.list-entry__content')).backgroundColor,
      },
      events: ['event-gray', 'event-yellow'].map((id) => {
        const node = document.querySelector('.journal-list-event[data-user-journal-event="' + id + '"]');
        const reference = normal?.getBoundingClientRect();
        const label = node?.querySelector('.journal-record-label')?.getBoundingClientRect();
        const date = node?.querySelector('.journal-record-date')?.getBoundingClientRect();
        const rightDuration = node?.querySelector('.journal-record-total')?.getBoundingClientRect();
        return {
          id,
          label: get(node, '.journal-record-label'),
          title: get(node, '.journal-record-procedures'),
          date: get(node, '.journal-record-date'),
          duration: get(node, '.journal-record-total'),
          swatchCount: node?.querySelectorAll('.list-entry__swatch').length,
          background: node ? getComputedStyle(node.querySelector('.list-entry__content')).backgroundColor : '',
          columns: node?.querySelectorAll('.list-entry__column').length,
          rowCount: node?.querySelectorAll('.list-entry__column-line').length,
          labelOffset: label && node ? Math.round(label.top - node.getBoundingClientRect().top) : null,
          dateOffset: date && node ? Math.round(date.top - node.getBoundingClientRect().top) : null,
          durationOffset: rightDuration && node ? Math.round(rightDuration.top - node.getBoundingClientRect().top) : null,
          referenceLabelOffset: normal ? Math.round(normal.querySelector('.journal-record-label').getBoundingClientRect().top - reference.top) : null,
          referenceDateOffset: normal ? Math.round(normal.querySelector('.journal-record-date').getBoundingClientRect().top - reference.top) : null,
          referenceAmountOffset: normal ? Math.round(normal.querySelector('.journal-record-total').getBoundingClientRect().top - reference.top) : null,
        };
      }),
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
  assert.equal(actual.events.length, 2);
  assert.deepEqual(actual.events.map((event) => event.label), ['Событие', 'Событие']);
  assert.deepEqual(actual.events.map((event) => event.date), ['26.10.26 · 11:00', '27.10.26 · 09:30']);
  assert.deepEqual(actual.events.map((event) => event.title), ['Рабочее событие', 'Консультация']);
  assert.deepEqual(actual.events.map((event) => event.duration), ['7 ч 30 мин', '30 мин']);
  assert.deepEqual(actual.events.map((event) => event.swatchCount), [0, 0]);
  assert.deepEqual(actual.events.map((event) => event.background), ['rgb(218, 219, 220)', 'rgb(255, 255, 186)']);
  assert.ok(actual.events.every((event) => event.columns === 2 && event.rowCount === actual.normal.rows));
  assert.ok(actual.events.every((event) => event.labelOffset === event.referenceLabelOffset
    && event.dateOffset === event.referenceDateOffset
    && event.durationOffset === event.referenceAmountOffset), 'Record and Event positions must match');
  assert.equal(actual.paid, 'Оплачено');
  assert.equal(actual.debt, 'Задолженность');
  assert.equal(actual.deleted.title, 'Запись');
  assert.equal(actual.deleted.date, '06.11.26 · 16:00');
  assert.equal(actual.deleted.services, 'Стрижка-женская · Окраска · Шатуш');
  assert.equal(actual.deleted.length, '3 ч');
  assert.equal(actual.deleted.status, 'Удалена');
  assert.equal(actual.deleted.amount, '');
  assert.equal(actual.deleted.text.includes('₽'), false);
  assert.equal(actual.deleted.bg, 'rgb(255, 255, 255)');
  assert.equal(actual.deleted.rows, actual.normal.rows);

  // Journal opens the SAME record mini-card as booking confirmation, in Q.
  // The Repeat icon is INSIDE that card. No delete/hide action exists here.
  await page.locator('.journal-list-record--active').filter({ hasText: 'Стрижка-женская' }).click();
  const liveQ = page.locator('[data-v2-q="true"]').last();
  await liveQ.locator('[data-user-journal-record-preview] .record-summary-mini-card--confirmation').waitFor();
  assert.equal(await liveQ.locator('[data-read-only-sheet]').count(), 0, 'Old X receipt must be removed');
  assert.equal(await liveQ.locator('.modal-actions').count(), 0, 'No detached action buttons');
  assert.equal(await liveQ.locator('[data-user-record-hide]').count(), 0, 'Journal has no delete/hide action');
  assert.equal(await liveQ.locator('.mini-card__record-action--right[data-user-record-repeat]').count(), 1);
  const dimensions = await liveQ.locator('.record-summary-mini-card--confirmation').evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    height: el.getBoundingClientRect().height,
    top: el.querySelector('.mini-card__record-head')?.parentElement === el,
    middle: getComputedStyle(el.querySelector('.mini-card__record-center')).overflowY,
    bottom: el.querySelector('.mini-card__record-footer')?.parentElement === el,
    nowrap: getComputedStyle(el.querySelector('.mini-card__record-moment')).whiteSpace,
    personGeometry: el.classList.contains('mini-card--record-person'),
    provider: el.querySelector('.mini-card__record-identity')?.textContent,
    period: el.querySelector('.mini-card__record-moment')?.textContent,
    titleFont: getComputedStyle(el.querySelector('.mini-card__record-identity')).fontSize,
    serviceFont: getComputedStyle(el.querySelector('.mini-card__record-center .mini-card__line')).fontSize,
    priceFont: getComputedStyle(el.querySelector('.mini-card__record-center .mini-card__line-right')).fontSize,
    noLeft: el.querySelector('.mini-card__record-top')?.classList.contains('mini-card__record-top--no-left'),
    placeholderHidden: getComputedStyle(el.querySelector('.mini-card__record-action-placeholder--left')).display,
    threeTotals: el.querySelector('.mini-card__record-footer')?.classList.contains('mini-card__record-footer--triple'),
    totalColumns: el.querySelectorAll('.mini-card__record-stat').length,
    footerCaptions: [...el.querySelectorAll('.mini-card__record-stat-label')].map(node=>node.textContent),
    footerValues: [...el.querySelectorAll('.mini-card__record-stat-value')].map(node=>node.textContent),
    centerRows: el.querySelectorAll('.mini-card__record-center .mini-card__line').length,
    centerText: el.querySelector('.mini-card__record-center')?.textContent,
  }));
  assert.equal(dimensions.width, 290);
  assert.equal(dimensions.height, 200);
  assert.equal(dimensions.top && dimensions.bottom && dimensions.personGeometry, true,
    'User record viewer must use the same fixed-head/footer geometry as Professional');
  assert.equal(dimensions.middle, 'auto');
  assert.equal(dimensions.nowrap, 'nowrap');
  assert.equal(dimensions.provider, 'Бьюти тория', 'The receiver sees the workplace, not their own repeated identity');
  assert.equal(dimensions.period, '07.11.26 · 12:00–15:00');
  assert.equal(dimensions.titleFont, '16px');
  assert.equal(dimensions.serviceFont, '15px');
  assert.equal(dimensions.priceFont, '15px');
  assert.equal(dimensions.noLeft, true, 'User cannot receive Professional service settings');
  assert.equal(dimensions.placeholderHidden, 'none', 'One action reclaims unused left slot');
  assert.equal(dimensions.threeTotals, true);
  assert.equal(dimensions.totalColumns, 3);
  assert.deepEqual(dimensions.footerCaptions, ['Время', '', 'Итого']);
  assert.equal(dimensions.footerValues[0], '3 ч');
  assert.match(dimensions.footerValues[2], /21\s?000\s?₽/);
  assert.equal(dimensions.centerRows, 3, 'Only booked services belong in viewer');
  assert.equal(/К оплате|Оплачено|Программа/.test(dimensions.centerText), false,
    'Payment statuses and programs must not be duplicated inside service area');
  await page.evaluate(() => {
    window.__repeat = null;
    window.addEventListener('cova:user-record-start', (event) => { window.__repeat = event.detail; }, { once: true });
  });
  await liveQ.locator('[data-user-record-repeat]').click();
  const repeatedCurrent = await page.evaluate(() => window.__repeat);
  assert.equal(repeatedCurrent?.contactId, 'tenant-one');
  assert.equal(repeatedCurrent?.repeatRequest?.id, 'future-1');

  // Source-deleted records retain their history indicator and can start a
  // fresh booking; they cannot be deleted or hidden from Journal.
  await page.locator('.journal-list-record--deleted').click();
  const deletedQ = page.locator('[data-v2-q="true"]').last();
  await deletedQ.locator('[data-user-journal-record-preview] .record-summary-mini-card--confirmation').waitFor();
  assert.equal(await deletedQ.locator('.mini-card__record-identity').innerText(), 'Запись');
  assert.ok((await deletedQ.locator('.mini-card__record-phone').innerText()).includes('Удалена'));
  assert.equal(await deletedQ.locator('[data-user-record-hide]').count(), 0);
  assert.equal(await deletedQ.locator('.mini-card__record-stat--total .mini-card__record-stat-value').innerText(), '');
  await page.evaluate(() => {
    window.__repeat = null;
    window.addEventListener('cova:user-record-start', (event) => { window.__repeat = event.detail; }, { once: true });
  });
  await deletedQ.locator('[data-user-record-repeat]').click();
  const repeated = await page.evaluate(() => window.__repeat);
  assert.equal(repeated?.contactId, 'tenant-one');
  assert.equal(Boolean(repeated?.repeatRequest), false);
  assert.equal(sourceRecords.length, 3);
  await mount();
  await page.locator('.journal-list-record--deleted').waitFor();
  console.log('PASS: Journal Q uses shared record mini-card, repeat icon only, no delete/hide action');

} finally {
  console.log('JOURNAL FIXTURE: closing browser and local server');
  server.closeAllConnections();
  await browser.close();
  await new Promise((done) => server.close(done));
  clearTimeout(watchdog);
}
