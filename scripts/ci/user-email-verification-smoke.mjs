import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.USER_RUNTIME_BASE || 'https://user-volokovykh.msk1.amvera.tech/';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ serviceWorkers: 'block', ignoreHTTPSErrors: false });

try {
  // Amvera can briefly serve mismatched assets while staging is republished.
  // Retry the complete real login bootstrap, never skip the requirement.
  let bootError = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 25_000 });
      assert.equal(response?.status(), 200, 'Staging User login HTML must load');
      await page.locator('[data-global-account-entry]').waitFor({ state: 'visible', timeout: 18_000 });
      bootError = null;
      break;
    } catch (error) {
      bootError = error;
      console.error('Email smoke login attempt ' + attempt + '/4: ' + String(error?.message || error));
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
  if (bootError) throw bootError;
  await page.evaluate(() => localStorage.setItem('user.account.token', 'mock-email-verification-session'));

  let verified = false;
  let requests = 0;
  await page.route('**/account/email-verification/status', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ email: 'test@example.com', verified }),
  }));
  await page.route('**/account/email-verification/request', (route) => {
    requests += 1;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: '{"accepted":true,"sent":true,"throttled":false}',
    });
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
    assert.equal(route.request().headers().authorization, undefined, 'Public confirmation must not require account login');
    confirmations += 1;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: '{"verified":true,"email":"test@example.com"}',
    });
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
}
