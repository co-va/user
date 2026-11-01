import { renderUser as renderUserApp } from './app.js';
import {
  installPasswordRecoveryRequest,
  isPasswordResetLocation,
  renderPasswordReset,
} from './password-recovery.js';

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
  setThemeColor('#2F3338');
  root.innerHTML = '<main id="user-content" data-user-runtime></main>';
  await renderUserApp(document.querySelector('#user-content'), initial);
  syncViewport();
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

installPasswordRecoveryRequest();
syncViewport();
setThemeColor('#2F3338');

if (isPasswordResetLocation()) {
  root.innerHTML = '<main id="user-content" data-user-runtime></main>';
  renderPasswordReset(document.querySelector('#user-content'));
  syncViewport();
} else {
  await import('./record-create.js');
  await renderUser();
}
