import { accountRequest } from './index.js';

export function getAccountEmailVerification() {
  return accountRequest(
    '/account/email-verification/status',
    { auth: true },
    'Не удалось проверить email',
  );
}

export function requestAccountEmailVerification() {
  return accountRequest(
    '/account/email-verification/request',
    { auth: true, method: 'POST' },
    'Не удалось отправить письмо подтверждения',
  );
}

export function confirmAccountEmailVerification(token) {
  return accountRequest(
    '/account/email-verification/confirm',
    {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ token: String(token || '').trim() }),
    },
    'Не удалось подтвердить email',
  );
}

export function changeAccountEmail(email) {
  return accountRequest(
    '/account/email-verification/change',
    {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ email }),
    },
    'Не удалось изменить email',
  );
}
