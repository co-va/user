import { accountRequest } from './index.js';

export function requestAccountPasswordReset(identifier) {
  return accountRequest('/account/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ identifier: String(identifier || '').trim() }),
  }, 'Не удалось отправить ссылку восстановления');
}

export function confirmAccountPasswordReset(token, newPassword) {
  return accountRequest('/account/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({
      token: String(token || '').trim(),
      newPassword: String(newPassword || ''),
    }),
  }, 'Не удалось изменить пароль');
}
