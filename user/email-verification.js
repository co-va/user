import { confirmAccountEmailVerification } from '../core/account/email.js';
import { v2Sticker } from '../ui/v2/sticker.js';
import { formError } from '../ui/forms/index.js';

export function isEmailVerificationLocation() {
  return window.location.pathname === '/verify-email.html';
}

function goToUser() {
  window.location.assign('/');
}

function renderResult(root, { title, body = '', error = '' } = {}) {
  root.innerHTML = `<section class="user-account">${v2Sticker({
    title,
    body: `${body}${formError(error)}`,
    action: '<button class="ui-button" type="button" data-email-verification-continue>Продолжить</button>',
    className: 'v2-sticker-screen--auth',
  })}</section>`;
  root.querySelector('[data-email-verification-continue]')?.addEventListener('click', goToUser);
}

export async function renderEmailVerification(root) {
  const params = new URLSearchParams(window.location.search);
  const kind = String(params.get('kind') || '').trim().toLowerCase();
  const token = String(params.get('token') || '').trim();

  if (kind !== 'account' || token.length < 32) {
    renderResult(root, {
      title: 'Подтверждение email',
      error: 'Ссылка подтверждения недействительна или устарела.',
    });
    return;
  }

  root.innerHTML = `<section class="user-account">${v2Sticker({
    title: 'Подтверждение email',
    body: '<p>Подтверждаем email…</p>',
    className: 'v2-sticker-screen--auth',
  })}</section>`;

  try {
    await confirmAccountEmailVerification(token);
    window.history.replaceState({}, '', '/');
    renderResult(root, {
      title: 'Email подтверждён',
      body: '<p>Email подтверждён. Можно продолжить работу в User.</p>',
    });
  } catch (error) {
    renderResult(root, {
      title: 'Подтверждение email',
      error: error instanceof Error ? error.message : 'Ссылка подтверждения недействительна или устарела.',
    });
  }
}
