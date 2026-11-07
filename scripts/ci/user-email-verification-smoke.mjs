import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.USER_RUNTIME_BASE || 'https://user-volokovykh.msk1.amvera.tech/';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ serviceWorkers: 'block', ignoreHTTPSErrors: false });

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  await page.locator('[data-global-account-entry]').waitFor({ state: 'visible', timeout: 20_000 });
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
  await page.locator('[data-user-email-verification-status]').getByText('Письмо принято почтовым сервером', { exact: false }).waitFor({ timeout: 12_000 });
  assert.equal(requests, 1, 'Unverified account must receive exactly one initial request');

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
    confirmations += 1;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: '{"verified":true,"email":"test@example.com"}',
    });
  });
  const link = new URL('/verify-email.html?kind=account&token=' + 'a'.repeat(40), base);
  const response = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  assert.equal(response?.status(), 200, 'User deep link must return HTML');
  await page.getByText('Email подтверждён', { exact: true }).waitFor({ state: 'visible', timeout: 12_000 });
  assert.equal(confirmations, 1, 'Token confirmation must be sent exactly once');
  console.log('User email verification: reminder, one send, verified skip, deep link: PASS');
} finally {
  await browser.close();
}
