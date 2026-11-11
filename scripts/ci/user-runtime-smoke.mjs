import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.USER_RUNTIME_BASE || 'https://user-volokovykh.msk1.amvera.tech/';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const maxAttempts = 4;

async function verifyRuntime() {
  const page = await browser.newPage({ ignoreHTTPSErrors: false, serviceWorkers: 'block' });
  const errors = [];
  try {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) => {
      if (!request.failure()?.errorText?.includes('ERR_ABORTED')) {
        errors.push(new URL(request.url()).pathname + ': ' + request.failure()?.errorText);
      }
    });

    const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    assert.equal(response?.status(), 200, 'User HTML must return 200');
    await page.locator('[data-global-account-entry]').waitFor({ state: 'visible', timeout: 18_000 });
    assert.equal(await page.locator('.app-bootstrap').count(), 0, 'User must not remain on Loading');
    assert.equal(errors.length, 0, 'User bootstrap errors: ' + errors.join('; '));
    console.log('PASS: anonymous User runtime renders interactive login at ' + base);

    if (new URL(base).hostname.endsWith('.amvera.tech')) {
      // This test actually runs in the preview browser and proves that
      // authenticated write routes reach the Core API, not preview's 405.
      const writeProbe = await page.evaluate(async () => {
        const { API_BASE } = await import('/core/environment.js');
        const response = await fetch(API_BASE + '/account/me', {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ci-invalid-user-token',
            'Content-Type': 'application/json',
          },
          body: '{}',
        });
        return { base: API_BASE, status: response.status };
      });
      assert.equal(writeProbe.base, 'https://api.va-tools.ru', 'Preview must use Core direct API');
      assert.ok([401, 403].includes(writeProbe.status),
        'Browser write route must be rejected by Core auth, not proxy/CORS');
      console.log('PASS: preview browser can reach authenticated Core writes; invalid token cannot mutate anything');
      const corsHeaders = {
        'access-control-allow-origin': new URL(base).origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
        'access-control-allow-headers': 'authorization,content-type',
      };
      let accountRequests = 0;
      let legalRequests = 0;
      await page.route('**/account/me', (route) => {
        if (route.request().method() === 'OPTIONS') {
          return route.fulfill({ status: 204, headers: corsHeaders });
        }
        accountRequests++;
        return route.fulfill({
          status: 401, contentType: 'application/json', headers: corsHeaders,
          body: '{"message":"Unauthorized"}',
        });
      });
      await page.route('**/account/platform-state', (route) => {
        if (route.request().method() === 'OPTIONS') {
          return route.fulfill({ status: 204, headers: corsHeaders });
        }
        legalRequests++;
        return route.fulfill({
          status: 200, contentType: 'application/json', headers: corsHeaders,
          body: '{"accepted":true,"document":{}}',
        });
      });
      await page.evaluate(() => localStorage.setItem('user.account.token', 'invalid-smoke-session'));
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.locator('[data-global-account-entry]').waitFor({ state: 'visible', timeout: 18_000 });
      assert.ok(accountRequests > 0, 'Expired-token account endpoint was not called');
      assert.ok(legalRequests > 0, 'Platform-state endpoint was not called');
      assert.equal(await page.evaluate(() => localStorage.getItem('user.account.token')), null,
        'Invalid session must be cleared');
      assert.equal(await page.locator('.app-bootstrap').count(), 0,
        'Expired session must not leave indefinite loading');
      assert.equal(errors.length, 0, 'User runtime errors: ' + errors.join('; '));
      console.log('PASS: 401 account with successful platform-state returns to login instead of hanging');
    }
  } catch (error) {
    throw new Error(String(error?.message || error)
      + (errors.length ? '\nBrowser request failures: ' + errors.join('; ') : ''));
  } finally {
    await page.close();
  }
}

try {
  // TLS 35 and missing assets are transient during Amvera edge republishing.
  // Every attempt must pass the FULL real browser scenario (not a mock or
  // status-only shortcut); repeated failures remain a red CI gate.
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await verifyRuntime();
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      console.error(`User runtime attempt ${attempt}/${maxAttempts}: ${error.message}`);
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
  if (lastError) throw lastError;
} finally {
  await browser.close();
}
