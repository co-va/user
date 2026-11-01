import { getAccountToken } from '../core/account/index.js';
import {
  enableWebPush,
  syncWebPush,
  webPushFailureMessage,
  webPushOptedOut,
  webPushSupported,
} from '../core/notifications/web-push.js';
import { button, escapeHtml, modal, mountModal } from '../ui/user-ui.js';

function accountAppReady() {
  return Boolean(document.querySelector('[data-v2-app]'));
}

function installedAppMode() {
  const displayStandalone = typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches;
  return displayStandalone || navigator.standalone === true;
}

function deviceCanOfferPushSetup() {
  const mobileApple = /iPhone|iPad|iPod/i.test(String(navigator.userAgent || ''));
  const coarsePointer = typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;

  if (mobileApple && coarsePointer) return installedAppMode();
  return true;
}

function shouldOfferAccountPushSetup({ optedOutAtSessionStart = false } = {}) {
  if (!webPushSupported()) return false;
  if (Notification.permission === 'denied') return false;
  if (!deviceCanOfferPushSetup()) return false;

  if (webPushOptedOut()) return optedOutAtSessionStart;
  return true;
}

function pushSetupModal(initialStatus = '') {
  return `<div class="modal-title">
    <h2>Уведомления на устройстве</h2>
    <p>Включите уведомления, чтобы узнавать о важных событиях, даже когда приложение или вкладка закрыты.</p>
  </div>
  <div class="modal-actions">
    ${button('Включить', { data: 'data-account-push-enable' })}
    ${button('Не сейчас', { data: 'data-account-push-later' })}
  </div>
  <div class="muted" data-account-push-status aria-live="polite">${escapeHtml(initialStatus)}</div>`;
}

async function offerPushSetupOnce({ optedOutAtSessionStart = false } = {}) {
  if (!webPushSupported() || !getAccountToken() || !accountAppReady()) return;

  if (Notification.permission === 'granted' && !webPushOptedOut()) {
    const state = await syncWebPush();
    if (state?.subscribed) return;
  }

  if (!shouldOfferAccountPushSetup({ optedOutAtSessionStart })) return;
  if (document.querySelector('[data-account-push-setup-modal]')) return;

  const layer = mountModal(document.body, modal(pushSetupModal(), {
    title: 'Уведомления на устройстве',
    variant: 'x',
    xRole: 'action',
    surface: 'app',
  }));
  if (!layer) return;

  layer.dataset.accountPushSetupModal = 'true';
  const enable = layer.querySelector('[data-account-push-enable]');
  const later = layer.querySelector('[data-account-push-later]');
  const status = layer.querySelector('[data-account-push-status]');

  later?.addEventListener('click', () => layer.remove());
  enable?.addEventListener('click', async () => {
    enable.disabled = true;
    if (status) status.textContent = 'Включаем…';
    try {
      const next = await enableWebPush({ strict: false });
      if (next?.subscribed) {
        layer.remove();
        return;
      }
      if (status) status.textContent = webPushFailureMessage(next) || 'Не удалось включить уведомления.';
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось включить уведомления.';
    } finally {
      if (enable.isConnected) enable.disabled = false;
    }
  });
}

export function startGlobalAccountPushRuntime() {
  let disposed = false;
  let checkedForSession = false;

  const checkSession = async () => {
    if (disposed) return;

    const token = String(getAccountToken() || '').trim();
    if (!token) {
      checkedForSession = false;
      return;
    }
    if (checkedForSession || !accountAppReady()) return;

    checkedForSession = true;
    const optedOutAtSessionStart = webPushOptedOut();
    try {
      await offerPushSetupOnce({ optedOutAtSessionStart });
    } catch {
      // Push setup must not block the User application.
    }
  };

  const host = document.querySelector('#app') || document.body;
  const observer = new MutationObserver(() => void checkSession());
  observer.observe(host, { childList: true, subtree: true });
  void checkSession();

  return () => {
    disposed = true;
    observer.disconnect();
  };
}

const disposeGlobalAccountPushRuntime = startGlobalAccountPushRuntime();
window.addEventListener('pagehide', () => disposeGlobalAccountPushRuntime(), { once: true });
