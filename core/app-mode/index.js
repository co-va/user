import { APP_ORIGIN, USER_ORIGIN } from '../environment.js';

export const APP_MODE_IDS = Object.freeze({
  PROFESSIONAL: 'professional',
  CONSUMER: 'consumer',
  MESSENGER: 'messenger',
  SOCIAL: 'social',
});

export const APP_MODES = Object.freeze([
  Object.freeze({
    id: APP_MODE_IDS.PROFESSIONAL,
    label: 'Профессионал',
    kind: 'domain',
    origin: APP_ORIGIN,
    visible: true,
  }),
  Object.freeze({
    id: APP_MODE_IDS.CONSUMER,
    label: 'Потребитель',
    kind: 'domain',
    origin: USER_ORIGIN,
    visible: true,
  }),
  Object.freeze({
    id: APP_MODE_IDS.MESSENGER,
    label: 'Сообщения',
    kind: 'embedded',
    origin: '',
    visible: true,
  }),
  Object.freeze({
    id: APP_MODE_IDS.SOCIAL,
    label: 'Соцсеть',
    kind: 'reserved',
    origin: '',
    visible: false,
  }),
]);

function hostnameOf(origin = '') {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

const PROFESSIONAL_HOST = hostnameOf(APP_ORIGIN);
const CONSUMER_HOST = hostnameOf(USER_ORIGIN);

export function visibleAppModes() {
  return APP_MODES.filter((mode) => mode.visible);
}

export function appModeDefinition(id = '') {
  return APP_MODES.find((mode) => mode.id === String(id || '').trim()) || null;
}

export function currentDomainAppMode(hostname = globalThis.location?.hostname || '') {
  const host = String(hostname || '').trim().toLowerCase();
  if (host === PROFESSIONAL_HOST) return APP_MODE_IDS.PROFESSIONAL;
  if (host === CONSUMER_HOST) return APP_MODE_IDS.CONSUMER;
  return '';
}

export function switchDomainAppMode(id, { assign = null, force = false } = {}) {
  const mode = appModeDefinition(id);
  if (!mode || mode.kind !== 'domain' || !mode.origin) return false;
  if (!force && currentDomainAppMode() === mode.id) return true;
  const navigate = typeof assign === 'function'
    ? assign
    : (url) => globalThis.location?.assign?.(url);
  navigate(mode.origin);
  return true;
}
