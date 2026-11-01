import { API_BASE } from '../environment.js';
import { getAccountToken } from './index.js';

const REQUEST_TIMEOUT_MS = 12000;

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAccountToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(payload?.message || 'Запрос платформы не выполнен'));
    return payload;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function getRecordTargets() {
  const payload = await request('/online-booking/account/booking-targets');
  return Array.isArray(payload) ? payload : [];
}

export async function getProfessionalRecordContext(professionalId, workplaceKey = '') {
  const id = String(professionalId || '').trim();
  if (!id) throw new Error('Профессионал не выбран');
  const params = new URLSearchParams();
  if (workplaceKey) params.set('workplace', workplaceKey);
  const suffix = params.toString() ? `?${params}` : '';
  return request(`/online-booking/${encodeURIComponent(id)}/context${suffix}`);
}

export async function createPlatformRecord(professionalId, data = {}) {
  const id = String(professionalId || '').trim();
  if (!id) throw new Error('Профессионал не выбран');
  return request(`/online-booking/${encodeURIComponent(id)}/requests`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
