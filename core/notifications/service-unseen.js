import { accountRequest, getAccountToken } from '../account/index.js';
import { publishServiceUnseen } from './app-badge.js';

const SERVICE_UNSEEN_KEY = '__VA_TOOLS_SERVICE_UNSEEN__';
const SERVICE_UNSEEN_ROLLOUT_AT = Date.parse('2026-10-29T17:20:31.000Z');
const REFRESH_INTERVAL_MS = 15_000;
let refreshBusy = false;
let refreshQueued = false;
let visibleSeenTimer = null;
let initialized = false;

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

function unseenRecordIds() {
  return new Set(getServiceUnseenState().items.flatMap((item) => recordIds(item?.recordIds)));
}

function markerNode(label = '🔴 Новая') {
  const marker = document.createElement('small');
  marker.dataset.serviceUnseenMarker = 'true';
  marker.textContent = label;
  return marker;
}

function syncMarkers() {
  if (typeof document === 'undefined') return;
  const unseen = unseenRecordIds();

  document.querySelectorAll('[data-service-unseen-marker]').forEach((marker) => {
    const owner = marker.closest('[data-journal-list-record],[data-user-journal-record],[data-time-usage]');
    const id = text(owner?.dataset?.journalListRecord || owner?.dataset?.userJournalRecord || owner?.dataset?.timeUsage);
    if (!id || !unseen.has(id)) marker.remove();
  });

  document.querySelectorAll('[data-journal-list-record],[data-user-journal-record]').forEach((row) => {
    const id = text(row.dataset.journalListRecord || row.dataset.userJournalRecord);
    if (!id || !unseen.has(id) || row.querySelector('[data-service-unseen-marker]')) return;
    const target = row.querySelector('.list-entry__right') || row;
    target.prepend(markerNode());
  });

  document.querySelectorAll('[data-time-usage]').forEach((usage) => {
    const id = text(usage.dataset.timeUsage);
    if (!id || !unseen.has(id) || usage.querySelector('[data-service-unseen-marker]')) return;
    const target = usage.querySelector('.journal-record__identity') || usage.querySelector('.journal-record') || usage;
    target.append(markerNode(' 🔴'));
  });
}

function actuallyVisible(node) {
  if (!node?.isConnected || node.getClientRects().length === 0) return false;
  const rect = node.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
  const viewportWidth = window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0;
  return rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
}

function visibleDayRecordIds() {
  const unseen = unseenRecordIds();
  const ids = [];
  document.querySelectorAll('[data-time-usage]').forEach((usage) => {
    const id = text(usage.dataset.timeUsage);
    if (!id || !unseen.has(id) || !actuallyVisible(usage)) return;
    ids.push(id);
  });
  return [...new Set(ids)];
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

export async function markRecordsSeen(ids) {
  const values = recordIds(ids);
  if (!values.length) return true;
  const items = getServiceUnseenState().items.filter((item) => item.recordIds.some((id) => values.includes(id)));
  if (!items.length) return true;
  try {
    await accountRequest('/account/service-unseen/seen', {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ recordIds: values }),
    }, 'Не удалось отметить уведомления прочитанными');
    removeSeenLocally(values);
    return true;
  } catch {
    // Keep the indicator visible for a later retry.
    return false;
  }
}

function scheduleVisibleSeen() {
  if (visibleSeenTimer) window.clearTimeout(visibleSeenTimer);
  visibleSeenTimer = window.setTimeout(() => {
    visibleSeenTimer = null;
    const ids = visibleDayRecordIds();
    if (ids.length) void markRecordsSeen(ids);
  }, 700);
}

function publish(items) {
  const state = publishServiceUnseen(items);
  syncMarkers();
  scheduleVisibleSeen();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('va-tools:service-unseen', { detail: state }));
  }
  return state;
}

export async function refreshServiceUnseen() {
  if (!getAccountToken()) return;
  if (refreshBusy) {
    refreshQueued = true;
    return;
  }
  refreshBusy = true;
  try {
    const payload = await accountRequest('/account/service-unseen', { auth: true }, 'Не удалось обновить сервисные уведомления');
    if (payload) publish(normalizeAccountItems(payload));
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
    scheduleVisibleSeen();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const onRefresh = () => void refreshServiceUnseen();
  const onFocus = () => {
    if (!document.hidden) void refreshServiceUnseen();
  };
  const onClick = (event) => {
    const row = event.target.closest?.('[data-journal-list-record],[data-user-journal-record]');
    const id = text(row?.dataset?.journalListRecord || row?.dataset?.userJournalRecord);
    if (id && unseenRecordIds().has(id)) void markRecordsSeen([id]);
  };

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
    if (visibleSeenTimer) window.clearTimeout(visibleSeenTimer);
    window.clearInterval(interval);
    window.removeEventListener('va-tools:service-unseen-refresh', onRefresh);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onFocus);
    document.removeEventListener('click', onClick, true);
    initialized = false;
  };
}

if (typeof window !== 'undefined') startServiceUnseenRuntime();
