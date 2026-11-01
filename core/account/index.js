import { API_BASE } from '../environment.js';
import { PLATFORM_PRIVACY_POLICY } from './platform-documents.js';

const ACCOUNT_TOKEN_KEY = 'user.account.token';
const ACCOUNT_EMAIL_KEY = 'user.account.email';
const REQUEST_TIMEOUT_MS = 12000;
let globalAccountCacheToken = '';
let globalAccountCache = null;

export function getAccountToken() {
  return localStorage.getItem(ACCOUNT_TOKEN_KEY) || '';
}

export function getRememberedAccountEmail() {
  return localStorage.getItem(ACCOUNT_EMAIL_KEY) || '';
}

export function clearAccount() {
  localStorage.removeItem(ACCOUNT_TOKEN_KEY);
  globalAccountCacheToken = '';
  globalAccountCache = null;
}

async function request(path, { auth = false, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (auth) {
    const token = getAccountToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

const TECHNICAL_ACCOUNT_MESSAGE = /(?:\b(?:Account|tenant|Prisma|Exception|Error|stack|SQL|token|undefined|null)\b|\bid\b|\.js\b|\.ts\b|\/api\/|\{.*\}|\[.*\])/i;

function safeAccountApiMessage(value, fallbackMessage) {
  const raw = Array.isArray(value) ? value[0] : value;
  const message = String(raw || '').trim();
  const system = !message
    || message.length > 240
    || message.includes('\n')
    || TECHNICAL_ACCOUNT_MESSAGE.test(message)
    || !/[А-Яа-яЁё]/.test(message);
  return { message: system ? fallbackMessage : message, system };
}

class AccountRequestError extends Error {
  constructor(message, { system = false } = {}) {
    super(message);
    this.name = 'AccountRequestError';
    this.userSafe = true;
    this.system = Boolean(system);
  }
}

export function accountErrorMessage(error, fallbackMessage) {
  return error instanceof AccountRequestError && error.userSafe === true
    ? error.message
    : fallbackMessage;
}

export function isAccountSystemError(error) {
  return !(error instanceof AccountRequestError) || error.system === true;
}

async function jsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const safe = safeAccountApiMessage(payload?.message, fallbackMessage);
    throw new AccountRequestError(safe.message, { system: safe.system });
  }
  return payload;
}

function storeSession(payload) {
  if (payload?.accessToken) localStorage.setItem(ACCOUNT_TOKEN_KEY, payload.accessToken);
  if (payload?.account?.email) localStorage.setItem(ACCOUNT_EMAIL_KEY, payload.account.email);
  if (payload?.account && payload?.accessToken) {
    globalAccountCacheToken = String(payload.accessToken);
    globalAccountCache = payload.account;
  }
  return payload;
}

export async function getAccountTerms() {
  return jsonResponse(
    await request('/online-booking/account-terms'),
    'Не удалось загрузить Условия использования учетной записи',
  );
}

export async function getGlobalAccountPlatformState() {
  const state = await jsonResponse(
    await request('/online-booking/account/platform-state', { auth: true }),
    'Не удалось проверить Условия использования учетной записи',
  );
  return { ...state, privacyPolicy: PLATFORM_PRIVACY_POLICY };
}

export async function acceptGlobalAccountTerms(accountTerms) {
  return jsonResponse(
    await request('/online-booking/account/platform-terms', {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ accountTerms }),
    }),
    'Не удалось сохранить принятие Условий использования учетной записи',
  );
}

export async function prepareGlobalAccount(input) {
  const body = input && typeof input === 'object' && !Array.isArray(input)
    ? input
    : { identifier: String(input || '').trim() };
  return jsonResponse(
    await request('/online-booking/account/prepare', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    'Не удалось проверить аккаунт',
  );
}

export async function registerGlobalAccount(data) {
  const payload = await jsonResponse(
    await request('/online-booking/account/register', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
    'Не удалось создать аккаунт',
  );
  return storeSession(payload);
}

export async function loginGlobalAccount(identifier, password) {
  const payload = await jsonResponse(
    await request('/online-booking/account/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
    'Не удалось войти',
  );
  return storeSession(payload);
}

export async function getGlobalAccount() {
  const token = getAccountToken();
  if (!token) return null;
  if (globalAccountCache && globalAccountCacheToken === token) return globalAccountCache;

  const response = await request('/online-booking/account/me', { auth: true });
  if (response.status === 401) {
    clearAccount();
    return null;
  }

  const account = await jsonResponse(response, 'Не удалось открыть аккаунт');
  globalAccountCacheToken = token;
  globalAccountCache = account;
  return account;
}

export async function updateGlobalAccount(data) {
  const account = await jsonResponse(
    await request('/online-booking/account/me', {
      auth: true,
      method: 'PUT',
      body: JSON.stringify(data || {}),
    }),
    'Не удалось обновить аккаунт',
  );
  globalAccountCacheToken = getAccountToken();
  globalAccountCache = account;
  return account;
}

export async function deleteGlobalAccount() {
  const result = await jsonResponse(
    await request('/online-booking/account/me', {
      auth: true,
      method: 'DELETE',
    }),
    'Не удалось удалить профиль',
  );
  clearAccount();
  return result;
}

export async function changeGlobalAccountPassword(currentPassword, newPassword) {
  return jsonResponse(
    await request('/online-booking/account/password', {
      auth: true,
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
    'Не удалось изменить пароль',
  );
}

export async function deleteGlobalAccountRelationship(tenantId) {
  return jsonResponse(
    await request(`/online-booking/account/relationships/${encodeURIComponent(String(tenantId || ''))}`, {
      auth: true,
      method: 'DELETE',
    }),
    'Не удалось удалить контакт',
  );
}

export async function getGlobalAccountRecords() {
  return jsonResponse(
    await request('/online-booking/account/records', { auth: true }),
    'Не удалось загрузить историю аккаунта',
  );
}

export async function getBookingContext(tenantId, workplaceKey = '') {
  const params = new URLSearchParams();
  if (workplaceKey) params.set('workplace', workplaceKey);
  const suffix = params.toString() ? `?${params}` : '';
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(String(tenantId || ''))}/context${suffix}`),
    'Не удалось загрузить онлайн-запись',
  );
}

export async function getAccount(tenantId) {
  const token = getAccountToken();
  if (!token) return null;

  const response = await request(`/online-booking/${encodeURIComponent(String(tenantId || ''))}/account/me`, {
    auth: true,
  });
  if (response.status === 401) {
    clearAccount();
    return null;
  }
  return jsonResponse(response, 'Не удалось открыть аккаунт');
}

export async function createBookingRequest(tenantId, data) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(String(tenantId || ''))}/requests`, {
      auth: true,
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
    'Не удалось подтвердить запись',
  );
}

export async function getAccountConsentState(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(String(tenantId || ''))}/account/consent-state`, {
      auth: true,
    }),
    'Не удалось проверить согласия',
  );
}

export async function submitAccountConsents(tenantId, consents = []) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(String(tenantId || ''))}/account/consents`, {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ consents }),
    }),
    'Не удалось сохранить согласия',
  );
}

export async function revokeAccountConsent(tenantId, documentId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(String(tenantId || ''))}/account/consents/${encodeURIComponent(String(documentId || ''))}/revoke`, {
      auth: true,
      method: 'POST',
    }),
    'Не удалось отозвать согласие',
  );
}
