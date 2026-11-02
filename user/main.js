import {
  installPasswordRecoveryRequest,
  isPasswordResetLocation,
  renderPasswordReset,
} from './password-recovery.js';
import {
  isEmailVerificationLocation,
  renderEmailVerification,
} from './email-verification.js';

const root = document.querySelector('#app');

function syncViewport() {
  const vv = window.visualViewport;
  const height = vv?.height || window.innerHeight;
  const width = vv?.width || window.innerWidth;
  document.documentElement.style.setProperty('--visual-vh', `${height}px`);
  document.documentElement.style.setProperty('--visual-vw', `${width}px`);
  document.documentElement.classList.toggle('keyboard-open', vv ? height < window.innerHeight * 0.78 : false);
}

function setThemeColor(value) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value);
}

async function renderUser(initial = {}) {
  const { renderUser: renderUserApp } = await import('./app.js');
  setThemeColor('#2F3338');
  root.innerHTML = '<main id="user-content" data-user-runtime></main>';
  await renderUserApp(document.querySelector('#user-content'), initial);
  syncViewport();
}

function installRecordRuntimeLoader() {
  let runtimePromise = null;

  const removeLoaders = () => {
    window.removeEventListener('cova:user-record-open-contacts', loadAndReplay);
    window.removeEventListener('cova:user-record-start', loadAndReplay);
  };

  const loadRuntime = () => {
    if (!runtimePromise) {
      runtimePromise = import('./record-create.js')
        .then((module) => {
          removeLoaders();
          return module;
        })
        .catch((error) => {
          runtimePromise = null;
          throw error;
        });
    }
    return runtimePromise;
  };

  const loadAndReplay = async (event) => {
    const type = String(event?.type || '');
    if (!type) return;
    const detail = event?.detail && typeof event.detail === 'object' ? event.detail : undefined;
    try {
      await loadRuntime();
      window.dispatchEvent(new CustomEvent(type, { detail }));
    } catch {
      // Следующий пользовательский клик повторит загрузку runtime.
    }
  };

  window.addEventListener('cova:user-record-open-contacts', loadAndReplay);
  window.addEventListener('cova:user-record-start', loadAndReplay);
  void loadRuntime().catch(() => {});
}

function installRecordRefreshTriggers() {
  let refreshPromise = null;
  let lastRefreshAt = 0;

  const refreshRecords = () => {
    const userRoot = document.querySelector('#user-content[data-user-runtime]');
    const state = userRoot?.userRelationshipState;
    if (!userRoot || !state?.account) return Promise.resolve();
    if (refreshPromise) return refreshPromise;
    if (Date.now() - lastRefreshAt < 1000) return Promise.resolve();
    lastRefreshAt = Date.now();

    refreshPromise = import('../core/account/index.js')
      .then(({ getGlobalAccountRecords }) => getGlobalAccountRecords())
      .then((records) => {
        if (!userRoot.isConnected || userRoot.userRelationshipState !== state) return;
        state.accountRecords = Array.isArray(records) ? records : [];
        if (state.accountTab !== 'journal') return;
        userRoot.querySelector('[data-account-journal-root]')?.userJournalRefresh?.();
      })
      .catch(() => {})
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  };

  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event?.data?.type === 'va-tools:push-unread') void refreshRecords();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshRecords();
  });
  window.addEventListener('focus', () => void refreshRecords());
}

window.addEventListener('cova:user-record-created', (event) => {
  const detail = event?.detail && typeof event.detail === 'object' ? event.detail : {};
  void renderUser({
    tab: 'journal',
    journalDate: String(detail.date || ''),
  });
});

window.addEventListener('resize', syncViewport, { passive: true });
window.visualViewport?.addEventListener('resize', syncViewport, { passive: true });
window.visualViewport?.addEventListener('scroll', syncViewport, { passive: true });

syncViewport();
setThemeColor('#2F3338');

if (isPasswordResetLocation()) {
  root.innerHTML = '<main id="user-content" data-user-runtime></main>';
  renderPasswordReset(document.querySelector('#user-content'));
  syncViewport();
} else if (isEmailVerificationLocation()) {
  root.innerHTML = '<main id="user-content" data-user-runtime></main>';
  await renderEmailVerification(document.querySelector('#user-content'));
  syncViewport();
} else {
  installPasswordRecoveryRequest();
  installRecordRuntimeLoader();
  installRecordRefreshTriggers();
  await renderUser();
}
