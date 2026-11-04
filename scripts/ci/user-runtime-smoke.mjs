import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.USER_RUNTIME_BASE || 'https://user-volokovykh.msk1.amvera.tech/';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const page = await browser.newPage({ ignoreHTTPSErrors: false, serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => {
    if (!request.failure()?.errorText?.includes('ERR_ABORTED')) {
      errors.push(new URL(request.url()).pathname + ': ' + request.failure()?.errorText);
    }
  });

  const result = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  assert.equal(result?.status(), 200, 'User HTML must return 200');
  await page.locator('[data-global-account-entry]').waitFor({ state: 'visible', timeout: 18_000 });
  assert.equal(await page.locator('.app-bootstrap').count(), 0, 'User must not remain on Loading');
  assert.equal(errors.length, 0, 'User bootstrap errors: ' + errors.join('; '));
  console.log('PASS: anonymous User runtime renders interactive login at ' + base);

  if (new URL(base).hostname.endsWith('.amvera.tech')) {
    let accountRequests = 0;
    let legalRequests = 0;
    await page.route('**/account/me', (route) => {
      accountRequests++;
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{"message":"Unauthorized"}',
      });
    });
    await page.route('**/account/platform-state', (route) => {
      legalRequests++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"accepted":true,"document":{}}',
      });
    });
    await page.evaluate(() => localStorage.setItem('user.account.token', 'invalid-smoke-session'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-global-account-entry]').waitFor({ state: 'visible', timeout: 18_000 });
    assert.ok(accountRequests > 0, 'Expired-token account endpoint was not called');
    assert.ok(legalRequests > 0, 'Platform-state endpoint was not called');
    assert.equal(await page.evaluate(() => localStorage.getItem('user.account.token')), null, 'Invalid session must be cleared');
    assert.equal(await page.locator('.app-bootstrap').count(), 0, 'Expired session must not leave indefinite loading');
    console.log('PASS: 401 account with successful platform-state returns to login instead of hanging');
  }

  await page.close();
} finally {
  await browser.close();
}
