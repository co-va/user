import { accountRequest } from '../account/index.js';

export function getAccountNotificationSettings() {
  return accountRequest('/account/notification-settings', { auth: true },
    'Не удалось загрузить настройки Email');
}

export function saveAccountNotificationSettings(email) {
  return accountRequest('/account/notification-settings', {
    auth: true,
    method: 'PUT',
    body: JSON.stringify({ email: Boolean(email) }),
  }, 'Не удалось сохранить настройку Email');
}
