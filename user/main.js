import { renderGlobalUser } from './account.js';

const root = document.querySelector('#app');
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

async function renderUser(initial = {}) {
  setThemeColor('#2F3338');
  root.classList.remove('app-shell--booking');
  root.innerHTML = '<main id="user-content" data-user-runtime></main>';
  await renderGlobalUser(document.querySelector('#user-content'), initial);
  syncViewport();
}

async function ensureBookingRuntime() {
  if (!bookingRuntimePromise) {
    bookingRuntimePromise = import('../booking/entry.js').then((module) => {
      bookingRuntimeReady = true;
      return module;
    });
  }
  return bookingRuntimePromise;
}


function preloadBookingRuntime() {
  if (bookingRuntimePromise || bookingRuntimeReady) return;
  const load = () => { void ensureBookingRuntime(); };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 1200 });
  else window.setTimeout(load, 0);
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

window.addEventListener('cova:user-booking-created', (event) => {
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
await renderUser();
preloadBookingRuntime();
