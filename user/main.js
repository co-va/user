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
    window.removeEventListener('cova:user-record-open-professionals', loadAndReplay);
    window.removeEventListener('cova:user-record-start', loadAndReplay);
  };

  const loadAndReplay = async (event) => {
    const type = String(event?.type || '');
    if (!type) return;
    const detail = event?.detail && typeof event.detail === 'object' ? event.detail : undefined;
    try {
      if (!runtimePromise) runtimePromise = import('./record-create.js');
      await runtimePromise;
      removeLoaders();
      window.dispatchEvent(new CustomEvent(type, { detail }));
    } catch {
      runtimePromise = null;
    }
  };

  window.addEventListener('cova:user-record-open-professionals', loadAndReplay);
  window.addEventListener('cova:user-record-start', loadAndReplay);
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
  await renderUser();
}
