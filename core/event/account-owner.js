import { accountRequest } from '../account/index.js';
import { createAccountCacheScope } from '../account/session-cache.js';

let rows = [];
let loaded = false;
let loading = null;
const sessionScope = createAccountCacheScope(() => {
  rows = [];
  loaded = false;
  loading = null;
});

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function normalize(value = {}) {
  const now = new Date().toISOString();
  return {
    id: String(value?.id || ''),
    ownerType: 'account',
    ownerId: String(value?.ownerId || ''),
    context: value?.context && typeof value.context === 'object' && !Array.isArray(value.context)
      ? clone(value.context)
      : { scope: 'account' },
    date: String(value?.date || '').slice(0, 10),
    from: String(value?.from || ''),
    to: String(value?.to || ''),
    title: String(value?.title || ''),
    description: String(value?.description || ''),
    color: String(value?.color || '#777A7D'),
    createdAt: String(value?.createdAt || now),
    updatedAt: String(value?.updatedAt || value?.createdAt || now),
  };
}

function eventId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function syncCalendars() {
  void accountRequest(
    '/account/calendar/sync',
    { auth: true, method: 'POST' },
    'Не удалось синхронизировать календарь.',
  ).catch(() => {});
}

function replaceRow(value) {
  const event = normalize(value);
  const index = rows.findIndex((item) => item.id === event.id);
  if (index >= 0) rows[index] = event;
  else rows.push(event);
  return clone(event);
}

export function accountEventsLoaded() { sessionScope.current(); return loaded; }
export function getAccountEvents() { sessionScope.current(); return rows.map(clone); }
export function getAccountEvent(id) {
  sessionScope.current();
  const row = rows.find((item) => item.id === String(id || ''));
  return row ? clone(row) : null;
}

export async function loadAccountEvents({ force = false } = {}) {
  const scope = sessionScope.current();
  if (loaded && !force) return getAccountEvents();
  if (loading && !force) return loading;
  const pending = accountRequest('/account/events', { auth: true }, 'Не удалось загрузить события.')
    .then((payload) => {
      if (!sessionScope.matches(scope)) return [];
      rows = (Array.isArray(payload) ? payload : []).map(normalize).filter((item) => item.id);
      loaded = true;
      return getAccountEvents();
    })
    .finally(() => { if (loading === pending) loading = null; });
  loading = pending;
  return pending;
}

export async function createAccountEvent(input = {}) {
  const scope = sessionScope.current();
  const event = normalize({
    ...input,
    id: String(input?.id || eventId()),
    ownerType: 'account',
    context: { ...(input?.context || {}), scope: 'account' },
  });
  const saved = await accountRequest(
    `/account/events/${encodeURIComponent(event.id)}`,
    {
      auth: true,
      method: 'PUT',
      body: JSON.stringify({ event }),
    },
    'Сервер не подтвердил сохранение события.',
  );
  if (!sessionScope.matches(scope)) throw new Error('Сессия изменилась.');
  loaded = true;
  const result = replaceRow(saved);
  syncCalendars();
  return result;
}

export async function updateAccountEvent(id, patch = {}) {
  const scope = sessionScope.current();
  const current = getAccountEvent(id);
  if (!current) throw new Error('Событие не найдено.');
  const event = normalize({ ...current, ...clone(patch), id: current.id, createdAt: current.createdAt });
  const saved = await accountRequest(
    `/account/events/${encodeURIComponent(current.id)}`,
    {
      auth: true,
      method: 'PUT',
      body: JSON.stringify({ event }),
    },
    'Сервер не подтвердил сохранение события.',
  );
  if (!sessionScope.matches(scope)) throw new Error('Сессия изменилась.');
  loaded = true;
  const result = replaceRow(saved);
  syncCalendars();
  return result;
}

export async function removeAccountEvent(id) {
  const scope = sessionScope.current();
  const key = String(id || '');
  if (!key) return false;
  await accountRequest(
    `/account/events/${encodeURIComponent(key)}`,
    { auth: true, method: 'DELETE' },
    'Не удалось удалить событие.',
  );
  if (!sessionScope.matches(scope)) throw new Error('Сессия изменилась.');
  rows = rows.filter((item) => item.id !== key);
  loaded = true;
  syncCalendars();
  return true;
}

export const accountEventActions = {
  read: getAccountEvent,
  create: createAccountEvent,
  update: updateAccountEvent,
  remove: removeAccountEvent,
};
