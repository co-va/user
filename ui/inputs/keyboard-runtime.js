// One shared viewport, keyboard and action-height controller for every Z, Q and X.
const EDITABLE_SELECTOR = [
  'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([disabled]):not([readonly])',
  'textarea:not([disabled]):not([readonly])',
  '[contenteditable="true"]',
].join(',');

const root = document.documentElement;
const viewport = () => window.visualViewport;
let stableHeight = 0;
let stableWidth = 0;
let actionsFrame = 0;

function activeEditable() {
  const node = document.activeElement;
  return node instanceof HTMLElement && node.matches(EDITABLE_SELECTOR) ? node : null;
}

function viewportSize() {
  const vv = viewport();
  return {
    height: Math.round(vv?.height || window.innerHeight || root.clientHeight || 0),
    width: Math.round(vv?.width || window.innerWidth || root.clientWidth || 0),
  };
}

function syncViewport() {
  const { height, width } = viewportSize();
  if (!height || !width) return;

  // Orientation changes can change the stable size; keyboard changes only height.
  if (!stableHeight || !stableWidth || Math.abs(width - stableWidth) > 48) {
    stableHeight = height;
    stableWidth = width;
  }
  const shrinking = height < stableHeight - 60;
  const keyboardOpen = shrinking && Boolean(activeEditable() || root.classList.contains('keyboard-open'));
  if (!keyboardOpen) {
    stableHeight = height;
    stableWidth = width;
  }

  root.style.setProperty('--app-stable-vh', `${stableHeight}px`);
  root.style.setProperty('--app-stable-vw', `${stableWidth}px`);
  // The application frame is anchored at top:0. Only its scrollable body
  // gets a keyboard inset; never move H/Z/Q following VisualViewport scroll.
  const inset = keyboardOpen ? Math.max(0, stableHeight - height) : 0;
  root.style.setProperty('--ui-keyboard-inset', `${Math.round(inset)}px`);
  root.classList.toggle('keyboard-open', keyboardOpen);
}

const observedActions = new Set();
const actionObserver = typeof ResizeObserver === 'function'
  ? new ResizeObserver(() => scheduleActionSync())
  : null;

function measurableAction(surface) {
  if (!surface) return null;
  // A hidden Q/Z footer remains measurable so editing does not suddenly
  // increase the inner scroll surface's height when Save first appears.
  return [...surface.querySelectorAll('.modal-actions')]
    .reverse()
    .find((node) => node.getBoundingClientRect().height > 0 && getComputedStyle(node).display !== 'none') || null;
}

function syncActionHeights() {
  actionsFrame = 0;
  const areas = document.querySelectorAll('[data-v2-z-body], [data-v2-q-body]');
  const nextActions = new Set();
  areas.forEach((area) => {
    const action = measurableAction(area);
    if (action) nextActions.add(action);
    const height = action ? Math.ceil(action.getBoundingClientRect().height) : 0;
    const value = `${height}px`;
    if (area.style.getPropertyValue('--ui-action-height') !== value) area.style.setProperty('--ui-action-height', value);
  });
  for (const node of observedActions) {
    if (!nextActions.has(node)) actionObserver?.unobserve(node);
  }
  for (const node of nextActions) {
    if (!observedActions.has(node)) actionObserver?.observe(node);
  }
  observedActions.clear();
  nextActions.forEach((node) => observedActions.add(node));

  const app = document.querySelector('[data-v2-app]');
  if (!app) return;
  const q = [...document.querySelectorAll('[data-v2-layer][data-v2-q="true"]')].at(-1);
  const z = [...app.querySelectorAll('[data-v2-z-layer]')].at(-1)
    || app.querySelector('[data-v2-front] > [data-v2-z]');
  const active = q || z;
  const action = measurableAction(active);
  const value = `${action && !action.hidden ? Math.ceil(action.getBoundingClientRect().height) : 0}px`;
  if (app.style.getPropertyValue('--ui-active-action-height') !== value) {
    app.style.setProperty('--ui-active-action-height', value);
  }
}

function scheduleActionSync() {
  if (actionsFrame) return;
  actionsFrame = requestAnimationFrame(syncActionHeights);
}

function onViewportChange() {
  // Avoid competing with WebKit's native scroll-to-focused-field behavior.
  // Z/Q use their own overflow areas, while the document itself is locked.
  syncViewport();
}

document.addEventListener('focusin', (event) => {
  if (!event.target?.matches?.(EDITABLE_SELECTOR)) return;
  onViewportChange();
});
document.addEventListener('focusout', onViewportChange);
window.addEventListener('resize', onViewportChange, { passive: true });
viewport()?.addEventListener('resize', onViewportChange, { passive: true });
viewport()?.addEventListener('scroll', onViewportChange, { passive: true });
document.addEventListener('visibilitychange', onViewportChange);

new MutationObserver(scheduleActionSync).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['hidden', 'class'],
});
window.addEventListener('user:v2-context-changed', scheduleActionSync);

syncViewport();
scheduleActionSync();
