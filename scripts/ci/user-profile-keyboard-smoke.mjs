import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

// Serve the checked-out staging files, NOT the Amvera preview: CI must
// measure the exact commit being tested, regardless of deployment delays.
const root = process.cwd();
const entry = await readFile(resolve(root, 'index.html'), 'utf8');
const stylePaths = [...entry.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((m) => m[1]);
const fixture = `<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${stylePaths.map((file) => `<link rel="stylesheet" href="/${file}">`).join('')}
</head><body><div id="app" class="app-shell"></div></body></html>`;

const mime = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  if (pathname === '/__profile_smoke__') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fixture);
    return;
  }
  const target = resolve(root, `.${decodeURIComponent(pathname)}`);
  if (!target.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(target);
    res.setHeader('Content-Type', mime[extname(target)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const base = `http://127.0.0.1:${server.address().port}/__profile_smoke__`;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const response = await page.goto(base, { waitUntil: 'load', timeout: 25_000 });
  assert.equal(response?.status(), 200, 'Local checked-out User fixture must load');

  const result = await page.evaluate(async () => {
    const { v2Shell } = await import('/ui/v2/shell.js');
    const { openAccountPersonalDataZ } = await import('/user/personal-data.js');
    const mount = document.querySelector('#app');
    if (!mount) throw new Error('App root missing');

    mount.innerHTML = v2Shell({
      header: '<header class="v2-header" data-v2-header>ABCD</header>',
      body: '<div>Journal</div>',
    });
    // The local fixture does not run the app bootstrap. Mount its one
    // production keyboard controller explicitly after creating the shell.
    await import('/ui/inputs/keyboard-runtime.js');
    const state = {
      account: {
        name: 'Алекс', surname: 'Тест2',
        phone: '+79951111111', email: 'test@example.com',
        profileData: { phones: [], emails: [], telegrams: [], links: [] },
      },
    };
    const layer = openAccountPersonalDataZ(mount, state);
    if (!layer) throw new Error('Shared personal data editor failed to mount');
    const input = layer.querySelector('[name="name"]');
    const save = layer.querySelector('[data-account-personal-save]');
    const actions = save?.closest('.modal-actions');
    if (!input || !actions) throw new Error('Profile field or save action missing');

    const initiallyHidden = actions.hasAttribute('data-ui-action-hidden') && getComputedStyle(actions).visibility === 'hidden';
    const app = mount.querySelector('[data-v2-app]');
    const portalSharesApp = layer.v2Portal?.parentElement === app;
    const body = layer.querySelector('[data-v2-q-body]');
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    await frame();
    await frame();
    document.documentElement.classList.add('keyboard-open');
    document.documentElement.style.setProperty('--ui-keyboard-inset', '350px');
    await frame();
    body.scrollTop = 90;
    const beforeSave = { height: body.scrollHeight, top: body.scrollTop };
    input.value = 'Александр';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await frame();
    await frame();
    const afterSave = { height: body.scrollHeight, top: body.scrollTop };
    body.scrollTop += 60;
    const scrollAfterSave = body.scrollTop;
    const visibleAfterEdit = !actions.hasAttribute('data-ui-action-hidden') && getComputedStyle(actions).visibility === 'visible';

    const box = (node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    };
    const header = mount.querySelector('[data-v2-header]');
    const q = layer.querySelector('.v2-layer--standard');
    const atRest = { header: box(header), q: box(q) };

    const whileTyping = { header: box(header), q: box(q) };

    document.documentElement.classList.remove('keyboard-open');
    document.documentElement.style.setProperty('--ui-keyboard-inset', '0px');
    const afterClose = { header: box(header), q: box(q), save: box(save) };

    // Simulate native WebKit visual viewport panning while the keyboard is
    // open. Visually fixed means layout top MINUS viewport offset is stable.
    input.focus({ preventScroll: true });
    const vv = window.visualViewport;
    const originalHeight = vv.height;
    const panBy = 117;
    Object.defineProperty(vv, 'height', { configurable: true, value: originalHeight - 300 });
    Object.defineProperty(vv, 'offsetTop', { configurable: true, value: panBy });
    // WebKit can delay scroll events until panning has finished. The shared
    // focus-time monitor must catch the visual offset without an event.
    await frame();
    await frame();
    const pan = {
      header: box(header), q: box(q),
      compensation: getComputedStyle(document.documentElement).getPropertyValue('--ui-visual-top').trim(),
    };
    delete vv.height;
    delete vv.offsetTop;
    vv.dispatchEvent(new Event('resize'));
    await frame();
    layer.v2Close?.();

    return {
      initiallyHidden, visibleAfterEdit, portalSharesApp,
      beforeSave, afterSave, scrollAfterSave,
      atRest, whileTyping, afterClose, pan, panBy,
    };
  });

  assert.equal(result.initiallyHidden, true, 'Pristine profile must preserve approved hidden-save rule');
  assert.equal(result.visibleAfterEdit, true, 'Save must appear after editing the name');
  assert.equal(result.portalSharesApp, true, 'Q portal must be within the app, not a separately fixed body overlay');
  assert.ok(Math.abs(result.afterSave.height - result.beforeSave.height) <= 1,
    `Revealing Save must not change editor scrollHeight: ${JSON.stringify({ before: result.beforeSave, after: result.afterSave })}`);
  assert.ok(Math.abs(result.afterSave.top - result.beforeSave.top) <= 1,
    'Revealing Save must not jump scroll position');
  assert.ok(result.scrollAfterSave > result.afterSave.top + 10,
    'Editor must remain scrollable after Save appears while keyboard is open');
  const near = (a, b, name) => assert.ok(Math.abs(a - b) <= 1, `${name}: ${a} vs ${b}`);
  near(result.atRest.header.top, result.whileTyping.header.top, 'H must not jump on typing');
  near(result.atRest.q.top, result.whileTyping.q.top, 'Q top must not jump on typing');
  near(result.atRest.q.top, result.afterClose.q.top, 'Q must return to original position');
  assert.equal(result.pan.compensation, `${result.panBy}px`, 'Viewport offset must be compensated at app root');
  near(result.pan.header.top - result.panBy, result.afterClose.header.top, 'H stays fixed in visual viewport');
  near(result.pan.q.top - result.panBy, result.afterClose.q.top, 'Q stays fixed in visual viewport');
  assert.ok(result.afterClose.save.top >= 0 && result.afterClose.save.bottom <= 844,
    `Save must be visible without scrolling when keyboard closes: ${JSON.stringify(result.afterClose.save)}`);

  console.log('PASS: local staging profile has app-owned Q, stable Save, and fixed visual viewport anchors');
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
