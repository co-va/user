import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.USER_RUNTIME_BASE || 'https://user-volokovykh.msk1.amvera.tech/';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  assert.equal(response?.status(), 200, 'Staging preview must be available');

  const result = await page.evaluate(async () => {
    const { v2Shell } = await import('/ui/v2/shell.js');
    const { openAccountPersonalDataZ } = await import('/user/personal-data.js');
    const mount = document.querySelector('#app');
    if (!mount) throw new Error('App root missing');

    mount.innerHTML = v2Shell({
      header: '<header class="v2-header" data-v2-header>ABCD</header>',
      body: '<div>Journal</div>',
    });
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
    layer.v2Close?.();

    return {
      initiallyHidden, visibleAfterEdit, portalSharesApp,
      beforeSave, afterSave, scrollAfterSave,
      atRest, whileTyping, afterClose,
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
  assert.ok(result.afterClose.save.top >= 0 && result.afterClose.save.bottom <= 844,
    `Save must be visible without scrolling when keyboard closes: ${JSON.stringify(result.afterClose.save)}`);

  console.log('PASS: real User profile has app-owned Q, stable scrolling after Save appears, and visible action on keyboard close');
} finally {
  await browser.close();
}
