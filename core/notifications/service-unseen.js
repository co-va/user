import { accountRequest, getAccountToken } from '../account/index.js';
import { publishServiceUnseen } from './app-badge.js';

const SERVICE_UNSEEN_KEY = '__VA_TOOLS_SERVICE_UNSEEN__';
const SERVICE_UNSEEN_ROLLOUT_AT = Date.parse('2026-10-29T17:20:31.000Z');
const REFRESH_INTERVAL_MS = 15_000;
let refreshBusy = false;
let refreshQueued = false;
let initialized = false;
const seenInFlight = new Set();

function text(value) {
  return String(value ?? '').trim();
}

function count(value) {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

function recordIds(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map((item) => text(item)).filter(Boolean))];
}

function afterRollout(value) {
  const stamp = Date.parse(String(value || ''));
  return Number.isFinite(stamp) && stamp >= SERVICE_UNSEEN_ROLLOUT_AT;
}

export async function loadDeletedRecordHistory() {
  const payload = await accountRequest('/account/deleted-record-history', { auth: true }, 'Не удалось загрузить историю удалённых записей');
  return Array.isArray(payload?.items) ? payload.items : [];
}

// Visibility is owned by Account, never by the source Record.
export async function loadJournalHiddenRecords() {
  const response = await accountRequest('/account/journal-hidden-records', { auth: true }, 'Не удалось загрузить скрытые записи');
  return Array.isArray(response?.items) ? response.items : [];
}

export async function hideJournalRecord(tenantId, recordId) {
  const response = await accountRequest('/account/journal-hidden-records', {
    auth: true,
    method: 'POST',
    body: JSON.stringify({ tenantId: String(tenantId || ''), recordId: String(recordId || '') }),
  }, 'Не удалось убрать запись из журнала');
  if (!response?.hidden) throw new Error('Сервер не подтвердил удаление из списка');
  return response;
}

export function getServiceUnseenState() {
  if (typeof globalThis === 'undefined') return { total: 0, items: [] };
  const state = globalThis[SERVICE_UNSEEN_KEY];
  return state && typeof state === 'object'
    ? { total: count(state.total), items: Array.isArray(state.items) ? state.items : [] }
    : { total: 0, items: [] };
}

function normalizeAccountItems(payload) {
  return (Array.isArray(payload?.items) ? payload.items : [])
    .filter((item) => text(item?.entityType).toLowerCase() === 'record' && afterRollout(item?.createdAt))
    .map((item) => ({
      id: text(item?.id),
      tenantId: text(item?.tenantId),
      type: text(item?.type),
      entityType: 'record',
      entityId: text(item?.entityId),
      recordIds: recordIds(item?.recordIds?.length ? item.recordIds : [item?.entityId]),
      date: text(item?.date).slice(0, 10),
      createdAt: item?.createdAt || '',
      owner: 'account',
    }))
    .filter((item) => item.id && item.recordIds.length);
}

function journalRecordIdentity(row) {
  const raw = text(row?.dataset?.journalListRecord || row?.dataset?.userJournalRecord);
  if (!raw) return { recordId: '', tenantId: '' };
  // The User Journal stores a composite [tenantId, recordId] key so identical
  // IDs in different spaces never get mixed up. Other consumers use raw IDs.
  if (raw.startsWith('[')) {
    try {
      const tuple = JSON.parse(raw);
      if (Array.isArray(tuple) && tuple.length === 2) {
        return { tenantId: text(tuple[0]), recordId: text(tuple[1]) };
      }
    } catch { /* Legacy raw identifier. */ }
  }
  return { recordId: raw, tenantId: '' };
}

function unseenForRow(row) {
  const { tenantId, recordId } = journalRecordIdentity(row);
  if (!recordId) return false;
  return getServiceUnseenState().items.some((item) =>
    (!tenantId || !text(item?.tenantId) || text(item.tenantId) === tenantId)
    && recordIds(item?.recordIds).includes(recordId));
}

function markerNode(label = '🔴 Новая') {
  const marker = document.createElement('small');
  marker.dataset.serviceUnseenMarker = 'true';
  marker.textContent = label;
  return marker;
}

function syncMarkers() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-service-unseen-marker]').forEach((marker) => {
    const owner = marker.closest('[data-journal-list-record],[data-user-journal-record]');
    if (!owner || !unseenForRow(owner)) marker.remove();
  });

  document.querySelectorAll('[data-journal-list-record],[data-user-journal-record]').forEach((row) => {
    if (!unseenForRow(row) || row.querySelector('[data-service-unseen-marker]')) return;
    const target = row.querySelector('.list-entry__right') || row;
    target.prepend(markerNode());
  });

}

function removeSeenLocally(ids) {
  const seen = new Set(recordIds(ids));
  const current = getServiceUnseenState().items;
  const remaining = current.filter((item) => !item.recordIds.some((id) => seen.has(id)));
  publishServiceUnseen(remaining);
  syncMarkers();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('va-tools:service-unseen', { detail: { total: remaining.length, items: remaining } }));
  }
}

export async function markRecordsSeen(ids, { force = false } = {}) {
  const token = getAccountToken();
  if (!token) return false;
  const values = recordIds(ids).filter((id) => !seenInFlight.has(JSON.stringify([token, id])));
  if (!values.length) return true; // A previous request is already acknowledging them.
  const items = getServiceUnseenState().items.filter((item) => item.recordIds.some((id) => values.includes(id)));
  if (!items.length && !force) return true;
  const keys = values.map((id) => JSON.stringify([token, id]));
  keys.forEach((key) => seenInFlight.add(key));
  try {
    await accountRequest('/account/service-unseen/seen', {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ recordIds: values }),
    }, 'Не удалось отметить уведомления прочитанными');
    if (getAccountToken() !== token) return false;
    removeSeenLocally(values);
    return true;
  } catch {
    // Keep the indicator visible for a later retry.
    return false;
  } finally {
    keys.forEach((key) => seenInFlight.delete(key));
  }
}


function publish(items) {
  const state = publishServiceUnseen(items);
  syncMarkers();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('va-tools:service-unseen', { detail: state }));
  }
  return state;
}

export async function refreshServiceUnseen() {
  const token = getAccountToken();
  if (!token) {
    if (getServiceUnseenState().total) publish([]);
    return;
  }
  if (refreshBusy) {
    refreshQueued = true;
    return;
  }
  refreshBusy = true;
  try {
    const payload = await accountRequest('/account/service-unseen', { auth: true }, 'Не удалось обновить сервисные уведомления');
    if (payload && getAccountToken() === token) publish(normalizeAccountItems(payload));
  } catch {
    // Notifications must never block the User application.
  } finally {
    refreshBusy = false;
    if (refreshQueued) {
      refreshQueued = false;
      queueMicrotask(() => void refreshServiceUnseen());
    }
  }
}

export function startServiceUnseenRuntime() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  initialized = true;
  let disposed = false;
  const observer = new MutationObserver(() => {
    if (disposed) return;
    syncMarkers();
    });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const onRefresh = () => void refreshServiceUnseen();
  const onFocus = () => {
    if (!document.hidden) void refreshServiceUnseen();
  };
  const onClick = (event) => {
    const row = event.target.closest?.('[data-journal-list-record],[data-user-journal-record]');
    if (!row || !unseenForRow(row)) return;
    const { recordId } = journalRecordIdentity(row);
    if (recordId) void markRecordsSeen([recordId]);
  };
  const onLogout = () => publish([]);

  window.addEventListener('user:auth-logout', onLogout);
  window.addEventListener('va-tools:service-unseen-refresh', onRefresh);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onFocus);
  document.addEventListener('click', onClick, true);

  void refreshServiceUnseen();
  const interval = window.setInterval(() => {
    if (!document.hidden) void refreshServiceUnseen();
  }, REFRESH_INTERVAL_MS);

  return () => {
    disposed = true;
    observer.disconnect();
    window.clearInterval(interval);
    window.removeEventListener('user:auth-logout', onLogout);
    window.removeEventListener('va-tools:service-unseen-refresh', onRefresh);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onFocus);
    document.removeEventListener('click', onClick, true);
    initialized = false;
  };
}

if (typeof window !== 'undefined') startServiceUnseenRuntime();
