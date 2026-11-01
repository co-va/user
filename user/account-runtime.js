import { getAccountToken } from '../core/account/index.js';
import {
  enableWebPush,
  shouldOfferWebPushSetup,
  syncWebPush,
  webPushFailureMessage,
  webPushOptedOut,
  webPushSupported,
} from '../core/notifications/web-push.js';
import { button, escapeHtml, modal, mountModal } from '../ui/user-ui.js';

const optedOutAtRuntimeStart = webPushOptedOut();

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

function shouldOfferAccountPushSetup() {
  if (!webPushSupported()) return false;
  if (Notification.permission === 'denied') return false;

  const optedOutNow = webPushOptedOut();
  if (optedOutNow) {
    // If Push was already disabled when this page opened, offer it again now.
    // If the user disabled Push during this runtime, do not immediately nag them.
    return optedOutAtRuntimeStart && deviceCanOfferPushSetup();
  }

  if (shouldOfferWebPushSetup()) return true;
  return deviceCanOfferPushSetup();
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

export function startGlobalAccountPushRuntime({ intervalMs = 1500 } = {}) {
  let disposed = false;
  let busy = false;
  let promptShown = false;
  let synchronized = false;
  let timer = null;

  const offer = async () => {
    if (disposed || busy || synchronized || !getAccountToken() || !accountAppReady()) return;
    if (!webPushSupported()) return;

    busy = true;
    try {
      if (Notification.permission === 'granted' && !webPushOptedOut()) {
        const state = await syncWebPush();
        synchronized = Boolean(state?.subscribed);
        if (synchronized) return;
      }

      if (!shouldOfferAccountPushSetup()) return;
      if (promptShown || document.querySelector('[data-account-push-setup-modal]')) return;

      promptShown = true;
      const layer = mountModal(document.body, modal(pushSetupModal(), {
        title: 'Уведомления на устройстве',
        variant: 'x',
        xRole: 'action',
        surface: 'app',
      }));
      if (!layer) {
        promptShown = false;
        return;
      }
      layer.dataset.accountPushSetupModal = 'true';
      const enable = layer.querySelector('[data-account-push-enable]');
      const later = layer.querySelector('[data-account-push-later]');
      const status = layer.querySelector('[data-account-push-status]');
      later?.addEventListener('click', () => {
        synchronized = true;
        layer.remove();
      });
      enable?.addEventListener('click', async () => {
        enable.disabled = true;
        if (status) status.textContent = 'Включаем…';
        try {
          const next = await enableWebPush({ strict: false });
          if (next?.subscribed) {
            synchronized = true;
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
    } catch {
      // Push setup must not block the Account application.
    } finally {
      busy = false;
    }
  };

  void offer();
  timer = window.setInterval(() => void offer(), Math.max(1000, Number(intervalMs) || 1500));
  return () => {
    disposed = true;
    if (timer) window.clearInterval(timer);
  };
}

const disposeGlobalAccountPushRuntime = startGlobalAccountPushRuntime();
window.addEventListener('pagehide', () => disposeGlobalAccountPushRuntime(), { once: true });
