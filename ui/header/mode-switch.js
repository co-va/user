import {
  APP_MODE_IDS,
  currentDomainAppMode,
  switchDomainAppMode,
  visibleAppModes,
} from '../../core/app-mode/index.js';
import { v2ListEntry, v2ListEntries } from '../lists/list-entry.js';
import { modal, mountModal } from '../modals/index.js';

let installed = false;

function messengerSurfaceActive() {
  if (typeof document === 'undefined') return false;
  if (String(globalThis.location?.hash || '') === '#chat') return true;
  return Boolean(document.querySelector(
    '.v2-workspace-surface--chat, .v2-app--chat, .v2-app--chat-list',
  ));
}

function activeModeId() {
  return messengerSurfaceActive()
    ? APP_MODE_IDS.MESSENGER
    : currentDomainAppMode();
}

function reopenOriginalChat(trigger) {
  if (!trigger?.isConnected) return false;
  if (String(trigger.dataset.appModeSourceKind || '') !== 'chat') return false;
  trigger.dataset.appModeBypass = 'true';
  trigger.click();
  queueMicrotask(() => {
    if (trigger.dataset.appModeBypass === 'true') delete trigger.dataset.appModeBypass;
  });
  return true;
}

function modeRows() {
  const active = activeModeId();
  return v2ListEntries(visibleAppModes().map((mode) => v2ListEntry({
    title: mode.label,
    rightTop: mode.id === active ? 'Текущий' : '',
    data: `data-app-mode-choice="${mode.id}"`,
    aria: `Перейти в режим ${mode.label}`,
  })));
}

export function openAppModeSwitch(trigger = null) {
  if (typeof document === 'undefined') return null;
  const existing = document.querySelector('[data-app-mode-modal]');
  if (existing) return existing;

  const layer = mountModal(document.body, modal(
    `<div data-app-mode-modal>${modeRows()}</div>`,
    { title: 'Режим', variant: 'x', xRole: 'action', surface: 'app', className: 'modal--app-mode' },
  ));
  if (!layer) return null;

  layer.querySelectorAll('[data-app-mode-choice]').forEach((node) => node.addEventListener('click', () => {
    const mode = String(node.dataset.appModeChoice || '');
    if (!mode) return;

    if (mode === APP_MODE_IDS.MESSENGER) {
      layer.v2Close?.();
      if (messengerSurfaceActive()) return;
      if (reopenOriginalChat(trigger)) return;
      window.dispatchEvent(new CustomEvent('va:app-mode-request', {
        detail: { mode: APP_MODE_IDS.MESSENGER },
      }));
      return;
    }

    const current = currentDomainAppMode();
    const returningFromMessenger = messengerSurfaceActive() && mode === current;
    if (switchDomainAppMode(mode, { force: returningFromMessenger })) layer.v2Close?.();
  }));

  return layer;
}

export function installAppModeSwitch() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', (event) => {
    const trigger = event.target?.closest?.('[data-app-mode-switch]');
    if (!trigger) return;
    if (trigger.dataset.appModeBypass === 'true') {
      delete trigger.dataset.appModeBypass;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    openAppModeSwitch(trigger);
  }, true);
}
