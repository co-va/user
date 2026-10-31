import { renderGlobalUser } from './account.js';

const app = document.querySelector('#app');
let bookingRuntimePromise = null;
let bookingRuntimeReady = false;

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

async function renderUserApp(initial = {}) {
  setThemeColor('#2F3338');
  app.classList.add('app-shell--booking');
  app.innerHTML = '<main class="booking-content" id="app-content" data-user-runtime></main>';
  await renderGlobalUser(document.querySelector('#app-content'), initial);
  syncViewport();
}

async function ensureBookingRuntime() {
  if (!bookingRuntimePromise) {
    bookingRuntimePromise = import('../online-booking/user-entry.js').then((module) => {
      bookingRuntimeReady = true;
      return module;
    });
  }
  return bookingRuntimePromise;
}

async function activateBookingEvent(type, detail = {}) {
  if (bookingRuntimeReady) return;
  await ensureBookingRuntime();
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

window.addEventListener('cova:account-journal-open-contacts', () => {
  if (bookingRuntimeReady) return;
  void activateBookingEvent('cova:account-journal-open-contacts');
});

window.addEventListener('cova:account-booking-start', (event) => {
  if (bookingRuntimeReady) return;
  const detail = event?.detail && typeof event.detail === 'object' ? event.detail : {};
  void activateBookingEvent('cova:account-booking-start', detail);
});

window.addEventListener('resize', syncViewport, { passive: true });
window.visualViewport?.addEventListener('resize', syncViewport, { passive: true });
window.visualViewport?.addEventListener('scroll', syncViewport, { passive: true });

syncViewport();
await renderUserApp();
