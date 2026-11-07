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
  page.on('pageerror', (error) => console.error('LOCAL PROFILE JS:', error.message));
  page.on('console', (message) => {
    if (message.type() === 'log' || message.type() === 'error') {
      console.log('LOCAL EDITOR:', message.text());
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).hostname === '127.0.0.1') {
      console.error('LOCAL PROFILE HTTP:', response.status(), response.url());
    }
  });
  const response = await page.goto(base, { waitUntil: 'load', timeout: 25_000 });
  assert.equal(response?.status(), 200, 'Local checked-out User fixture must load');

  const result = await Promise.race([
    page.evaluate(async () => {
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
    // WebKit may blur the final input while the keyboard is still visible.
    // Its temporary viewport height must NOT become the new Z/Q height.
    const baseline = getComputedStyle(document.documentElement).getPropertyValue('--app-stable-vh').trim();
    input.blur();
    await frame();
    await frame();
    const afterBlur = {
      stableHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-stable-vh').trim(),
      inset: getComputedStyle(document.documentElement).getPropertyValue('--ui-keyboard-inset').trim(),
      keyboardOpen: document.documentElement.classList.contains('keyboard-open'),
      header: box(header), q: box(q),
    };
    delete vv.height;
    delete vv.offsetTop;
    vv.dispatchEvent(new Event('resize'));
    await frame();
    layer.v2Close?.();

    return {
      initiallyHidden, visibleAfterEdit, portalSharesApp,
      beforeSave, afterSave, scrollAfterSave,
      atRest, whileTyping, afterClose, pan, panBy, afterBlur, baseline,
    };
  }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Local profile browser fixture timed out after 25s')), 25_000)),
  ]);

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
  assert.equal(result.afterBlur.stableHeight, result.baseline, 'Blur while keyboard remains cannot shrink app shell');
  assert.equal(result.afterBlur.keyboardOpen, true, 'Keep keyboard geometry until visible viewport recovers');
  assert.equal(result.afterBlur.inset, '300px', 'Keep keyboard work-area inset after blur');
  near(result.afterBlur.q.bottom, result.pan.q.bottom, 'Q bottom stays anchored through final-field blur');
  assert.ok(result.afterClose.save.top >= 0 && result.afterClose.save.bottom <= 844,
    `Save must be visible without scrolling when keyboard closes: ${JSON.stringify(result.afterClose.save)}`);

  console.log('PASS: local staging profile has app-owned Q, stable Save, and fixed visual viewport anchors');
  // Real editor matrix: use the actual event, note, and record creation
  // modules. All surfaces must use the shared Q/Z/X work area, never an
  // independently scrolling form specific to one editor.
  const editorCases = await Promise.race([
    page.evaluate(async () => {
      const [{ openUserEventView }, { openUserNoteView }, { openRecordCreationOwner },
        { createUserEventFlow }, { createUserNoteFlow }, { openSharedPasswordAction }] = await Promise.all([
        import('/user/event-view.js'),
        import('/user/note-view.js'),
        import('/ui/record/creation-flow.js'),
        import('/user/event-create.js'),
        import('/user/note-create.js'),
        import('/ui/profile/index.js'),
      ]);
      console.log('Editor matrix modules imported');
      const app = document.querySelector('[data-v2-app]');
      const z = app?.querySelector('[data-v2-front] > [data-v2-z]');
      const zBody = z?.querySelector(':scope > [data-v2-z-body]');
      if (!app || !zBody) throw new Error('Shared Z editor fixture missing');
      const html = document.documentElement;
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const results = [];
      const record = (name, mode, layer, actionSelector, nestedSelector = '') => {
        const surface = mode === 'x' ? layer.querySelector('.v2-layer--bottom')
          : mode === 'q' ? layer.querySelector('.v2-layer--standard') : z;
        const scroller = mode === 'x' ? surface : mode === 'q'
          ? layer.querySelector('[data-v2-q-body]') : zBody;
        const action = layer.querySelector(actionSelector);
        const nested = nestedSelector ? layer.querySelector(nestedSelector) : null;
        if (!surface || !scroller || !action) throw new Error(name + ': missing surface, work area or action');
        const modalPortal = mode === 'z' || layer.v2Portal?.parentElement === app;
        const nestedOverflow = nested ? getComputedStyle(nested).overflowY : 'none';
        // Measure the settled X frame, not the one-time entrance animation.
        surface.style.animation = 'none';
        const geometry = () => {
          const rect = surface.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, height: rect.height,
            header: app.querySelector('[data-v2-header]').getBoundingClientRect().top };
        };
        const before = geometry();
        html.classList.add('keyboard-open');
        html.style.setProperty('--ui-keyboard-inset', '360px');
        const after = geometry();
        const scrollCapacity = scroller.scrollHeight - scroller.clientHeight;
        const initial = scroller.scrollTop;
        scroller.scrollTop = scroller.scrollHeight + 500;
        const end = scroller.scrollTop;
        html.classList.remove('keyboard-open');
        html.style.setProperty('--ui-keyboard-inset', '0px');
        const save = action.getBoundingClientRect();
        const visible = save.height > 0 && save.top >= 0 && save.bottom <= 844;
        const result = { name, mode, modalPortal, nestedOverflow, before, after,
          scrollCapacity, initial, end, saveVisibleAfterClose: visible,
          scrollElement: scroller.getAttribute('data-v2-q-body') !== null ? 'Q'
            : scroller.getAttribute('data-v2-z-body') !== null ? 'Z' : 'X' };
        results.push(result);
      };
      const event = { id: 'editor-test-event', date: '2026-11-06',
        from: '11:00', to: '12:30', title: 'Событие', description: 'Проверка описания' };
      const eventActions = { read: () => event, update: async () => event, remove: async () => true, create: async () => event };
      console.log('Checking event Q');
      const eventLayer = openUserEventView(event, { eventActions });
      if (!eventLayer) throw new Error('Real event editor did not open');
      const shortPaper = eventLayer.querySelector('.note-sticker--event');
      if (!shortPaper || shortPaper.querySelector('.note-sticker__tape')) {
        throw new Error('Event preview must be one paper sticker without tape');
      }
      if (eventLayer.querySelector('[data-v2-q-header-content]')?.textContent?.trim()) {
        throw new Error('Event Q must not repeat a visible outer "Событие" heading');
      }
      if (getComputedStyle(shortPaper).borderTopLeftRadius !== '0px') {
        throw new Error('Event paper sticker must have square 90-degree corners');
      }
      const shortRect = shortPaper.getBoundingClientRect();
      event.description = 'Подробное описание события. '.repeat(260);
      eventLayer.querySelector('[data-user-event-edit]')?.click();
      eventLayer.querySelector('[data-user-event-cancel]')?.click();
      const longPaper = eventLayer.querySelector('.note-sticker--event');
      const longText = longPaper?.querySelector('.note-sticker__text');
      const longRect = longPaper?.getBoundingClientRect();
      if (!longPaper || !longText || !longRect) throw new Error('Long event paper is missing');
      if (Math.abs(shortRect.width - longRect.width) > 1 || longRect.height <= shortRect.height ||
          longRect.height > 461 || longText.scrollHeight <= longText.clientHeight) {
        throw new Error('Event preview must keep its width, grow vertically and scroll long text: ' +
          JSON.stringify({ short: shortRect.height, long: longRect.height,
            shortWidth: shortRect.width, longWidth: longRect.width,
            textScroll: longText.scrollHeight, textClient: longText.clientHeight }));
      }
      longText.scrollTop = longText.scrollHeight;
      if (longText.scrollTop <= 0) throw new Error('Long event text must scroll inside paper');
      eventLayer.querySelector('[data-user-event-edit]')?.click();
      record('Изменение события', 'q', eventLayer, '[type="submit"]');
      eventLayer.v2Close?.();

      const note = { id: 'editor-test-note', date: '2026-11-06', title: 'Заметка',
        text: 'Проверка содержимого', context: { scope: 'account' } };
      const noteActions = { read: () => note, update: async () => note, remove: async () => true, create: async () => note };
      console.log('Checking note Q');
      const noteLayer = openUserNoteView(note, { noteActions });
      if (!noteLayer) throw new Error('Real note editor did not open');
      noteLayer.querySelector('[data-user-note-edit]')?.click();
      record('Изменение заметки', 'q', noteLayer, '[data-user-note-save]');
      noteLayer.v2Close?.();

      console.log('Checking inline event Z');
      const inlineEvent = openRecordCreationOwner({ surfaceRoot: z, bodyRoot: zBody });
      if (!inlineEvent) throw new Error('Inline event creation did not open');
      createUserEventFlow({ owner: inlineEvent, date: '2026-11-06', eventActions });
      record('Создание события в Журнале', 'z', inlineEvent.layer,
        '[data-user-event-create-submit]', '.record-creation-flow__body');
      inlineEvent.close();

      console.log('Checking inline note Z');
      const inlineNote = openRecordCreationOwner({ surfaceRoot: z, bodyRoot: zBody });
      if (!inlineNote) throw new Error('Inline note creation did not open');
      createUserNoteFlow({ owner: inlineNote, date: '2026-11-06', noteActions });
      record('Создание заметки в Журнале', 'z', inlineNote.layer,
        '[data-user-note-create-submit]', '.record-creation-flow__body');
      inlineNote.close();

      console.log('Checking creation Q');
      const qOwner = openRecordCreationOwner();
      if (!qOwner) throw new Error('Q creation owner did not open');
      createUserEventFlow({ owner: qOwner, date: '2026-11-06', eventActions });
      record('Создание события через Q', 'q', qOwner.layer,
        '[data-user-event-create-submit]', '.record-creation-flow__body');
      qOwner.close();

      console.log('Checking password X');
      const passwordLayer = openSharedPasswordAction({ onSubmit: async () => {} });
      if (!passwordLayer) throw new Error('Real password X editor did not open');
      record('Изменение пароля', 'x', passwordLayer, '[type="submit"]');
      passwordLayer.v2Close?.();
      await frame();
      return results;
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Editor matrix did not finish in 25s')), 25_000)),
  ]);

  for (const item of editorCases) {
    assert.equal(item.modalPortal, true, item.name + ': modal must share application root');
    assert.equal(item.nestedOverflow, item.nestedOverflow === 'none' ? 'none' : 'visible',
      item.name + ': no second nested scrolling controller');
    if (item.mode === 'x') {
      near(item.after.bottom, item.before.bottom, item.name + ': X white surface must stay attached to bottom');
      assert.ok(item.after.top >= 0, item.name + ': X must stay below top stop');
      assert.ok(item.after.height >= item.before.height, item.name + ': X white surface extends beneath keyboard');
    } else {
      near(item.before.top, item.after.top, item.name + ': Z/Q surface must not shift with keyboard');
    }
    near(item.before.header, item.after.header, item.name + ': ABCD must remain stationary');
    assert.ok(item.scrollCapacity >= 0, item.name + ': work area scroll geometry is invalid');
    assert.ok(item.end <= item.scrollCapacity + 1, item.name + ': scrolling must stop at content');
    assert.equal(item.saveVisibleAfterClose, true, item.name + ': action must be visible after keyboard closes');
  }
  assert.deepEqual(editorCases.map((item) => item.scrollElement), ['Q', 'Q', 'Z', 'Z', 'Q', 'X']);
  console.log('PASS: all six real User editor flows keep Z/Q fixed and X white to bottom during keyboard');

} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolveClose) => server.close(resolveClose));
}
