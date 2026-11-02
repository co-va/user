import { accountRequest, getAccountToken } from '../account/index.js';

let syncInFlight = null;
let lastSyncAt = 0;

export function getAccountCalendarStatus() {
  return accountRequest('/account/calendar', { auth: true }, 'Не удалось загрузить календарь.');
}

export async function beginGoogleCalendarConnection() {
  const payload = await accountRequest(
    '/account/calendar/google/connect',
    { auth: true, method: 'POST' },
    'Не удалось подключить Google Calendar.',
  );
  const url = String(payload?.url || '');
  if (!url) throw new Error('Google не вернул ссылку подключения.');
  window.location.assign(url);
}

export function connectYandexCalendar({ login = '', password = '' } = {}) {
  return accountRequest(
    '/account/calendar/yandex/connect',
    {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ login, password }),
    },
    'Не удалось подключить Яндекс Календарь.',
  );
}

export function disconnectAccountCalendar(provider) {
  return accountRequest(
    `/account/calendar/${encodeURIComponent(String(provider || ''))}`,
    { auth: true, method: 'DELETE' },
    'Не удалось отключить календарь.',
  );
}

export function setAccountCalendarExport(provider, calendarId) {
  return accountRequest(
    `/account/calendar/${encodeURIComponent(String(provider || ''))}/export`,
    {
      auth: true,
      method: 'PUT',
      body: JSON.stringify({ calendarId }),
    },
    'Не удалось изменить экспорт календаря.',
  );
}

export function syncAccountCalendars({ force = false } = {}) {
  const token = getAccountToken();
  if (!token) return Promise.resolve({ connected: 0, synced: 0, skipped: true });
  if (syncInFlight) return syncInFlight;
  if (!force && Date.now() - lastSyncAt < 60_000) return Promise.resolve({ connected: 0, synced: 0, skipped: true });
  syncInFlight = accountRequest(
    '/account/calendar/sync',
    { auth: true, method: 'POST' },
    'Не удалось синхронизировать календарь.',
  )
    .then((result) => {
      lastSyncAt = Date.now();
      if (Number(result?.connected || 0) > 0) {
        window.dispatchEvent(new CustomEvent('cova:account-calendar-synced', { detail: result }));
      }
      return result;
    })
    .finally(() => { syncInFlight = null; });
  return syncInFlight;
}
