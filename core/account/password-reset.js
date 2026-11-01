import { API_BASE } from '../environment.js';

async function post(path, body, fallbackMessage) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.message || fallbackMessage));
  return payload;
}

export function requestAccountPasswordReset(identifier) {
  return post(
    '/online-booking/account/password-reset/request',
    { identifier: String(identifier || '').trim() },
    'Не удалось отправить ссылку восстановления',
  );
}

export function confirmAccountPasswordReset(token, newPassword) {
  return post(
    '/online-booking/account/password-reset/confirm',
    {
      token: String(token || '').trim(),
      newPassword: String(newPassword || ''),
    },
    'Не удалось изменить пароль',
  );
}
