import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

// Email verification is a local, mock-API browser contract for the exact
// checked-out commit. Live Amvera HTTPS/HTML/JS/API and auth are checked by
// staging-smoke and user-runtime-smoke separately at the PR gate.
const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
  const relative = pathname === '/' || pathname === '/verify-email.html'
    ? 'index.html'
    : pathname.replace(/^\/+/, '');
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(root + sep)) {
    res.writeHead(403); res.end(); return;
  }
  try {
    const bytes = await readFile(target);
    res.setHeader('Content-Type', mime[extname(target)] || 'application/octet-stream');
    res.end(bytes);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ serviceWorkers: 'block', ignoreHTTPSErrors: false });

// Mock responses must respect real cross-origin CORS preflights after User
// switched away from the legacy same-origin read-only /api bridge.
const corsHeaders = {
  'access-control-allow-origin': new URL(base).origin,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};
function mockJson(route, payload) {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
  return route.fulfill({
    status: 200, contentType: 'application/json', headers: corsHeaders,
    body: JSON.stringify(payload),
  });
}

try {
  // Boot the real User source modules for this commit; verify local login before
  // exercising the complete mocked email reminder and public token flow.
  let bootError = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 25_000 });
      assert.equal(response?.status(), 200, 'Local User login HTML must load');
      await page.locator('[data-global-account-entry]').waitFor({ state: 'visible', timeout: 18_000 });
      bootError = null;
      break;
    } catch (error) {
      bootError = error;
      console.error('Email smoke local login attempt ' + attempt + '/4: ' + String(error?.message || error));
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
  if (bootError) throw bootError;
  await page.evaluate(() => localStorage.setItem('user.account.token', 'mock-email-verification-session'));

  let verified = false;
  let requests = 0;
  await page.route('**/account/email-verification/status', (route) =>
    mockJson(route, { email: 'test@example.com', verified }));
  await page.route('**/account/email-verification/request', (route) => {
    if (route.request().method() !== 'OPTIONS') requests += 1;
    return mockJson(route, { accepted: true, sent: true, throttled: false });
  });

  await page.evaluate(async () => {
    const { offerAccountEmailVerificationReminder } = await import('/user/email-verification-reminder.js');
    const root = document.createElement('div');
    root.id = 'user-email-smoke-root';
    document.body.appendChild(root);
    const state = { account: { id: 'account-unverified', email: 'test@example.com' } };
    root.userRelationshipState = state;
    await offerAccountEmailVerificationReminder(root, state);
    await offerAccountEmailVerificationReminder(root, state);
  });
  await page.locator('[data-user-email-verification-reminder]').waitFor({ state: 'visible', timeout: 12_000 });
  await page.locator('[data-user-email-verification-status]').getByText('Письмо отправляется только по вашему запросу', { exact: false }).waitFor({ timeout: 12_000 });
  assert.equal(requests, 0, 'Opening the confirmation reminder must not send email');
  await page.locator('[data-user-email-verification-resend]').click();
  await page.locator('[data-user-email-verification-status]').getByText('Письмо принято почтовым сервером', { exact: false }).waitFor({ timeout: 12_000 });
  assert.equal(requests, 1, 'Clicking send must create exactly one manual request');

  await page.evaluate(() => window.dispatchEvent(new Event('user:auth-logout')));
  await page.locator('[data-user-email-verification-reminder]').waitFor({ state: 'detached', timeout: 12_000 });
  verified = true;
  await page.evaluate(async () => {
    const { offerAccountEmailVerificationReminder } = await import('/user/email-verification-reminder.js');
    const root = document.querySelector('#user-email-smoke-root');
    const state = { account: { id: 'account-verified', email: 'test@example.com' } };
    root.userRelationshipState = state;
    await offerAccountEmailVerificationReminder(root, state);
  });
  assert.equal(await page.locator('[data-user-email-verification-reminder]').count(), 0, 'Confirmed email must not show a prompt');
  assert.equal(requests, 1, 'Confirmed email must not receive another verification email');

  let confirmations = 0;
  await page.route('**/account/email-verification/confirm', (route) => {
    if (route.request().method() !== 'OPTIONS') {
      assert.equal(route.request().headers().authorization, undefined, 'Public confirmation must not require account login');
      confirmations += 1;
    }
    return mockJson(route, { verified: true, email: 'test@example.com' });
  });
  await page.evaluate(() => localStorage.removeItem('user.account.token'));
  const link = new URL('/verify-email.html?kind=account&token=' + 'a'.repeat(40), base);
  const response = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  assert.equal(response?.status(), 200, 'User deep link must return HTML');
  await page.getByText('Email подтверждён', { exact: true }).waitFor({ state: 'visible', timeout: 12_000 });
  assert.equal(confirmations, 1, 'Token confirmation must be sent exactly once');
  console.log('User email verification: no automatic send, explicit request, verified skip, public deep link: PASS');
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
