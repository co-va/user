import { API_BASE } from '../environment.js';
import { getAccountToken } from '../account/index.js';

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

function normalizePrice(source = {}) {
  return {
    minimum: Math.max(0, Number(source?.minimum) || 0),
    variable: Boolean(source?.variable),
    free: Boolean(source?.free),
  };
}

function normalizeProcedure(source = {}) {
  return {
    id: String(source?.id || ''),
    name: String(source?.name || ''),
    duration: Math.max(0, Number(source?.duration) || 0),
    workplaces: (Array.isArray(source?.workplaces) ? source.workplaces : []).map((workplace) => ({
      workplaceId: String(workplace?.workplaceId ?? workplace?.key ?? workplace?.id ?? ''),
      price: normalizePrice(workplace?.bookingPrice),
    })),
  };
}

function normalizeContext(source = {}) {
  return {
    workplaces: (Array.isArray(source?.workplaces) ? source.workplaces : []).map((workplace) => ({
      key: String(workplace?.key ?? workplace?.id ?? ''),
      name: String(workplace?.name || ''),
      city: String(workplace?.city || ''),
      address: String(workplace?.address || ''),
      timeZone: String(workplace?.timeZone || ''),
      from: String(workplace?.from || ''),
      to: String(workplace?.to || ''),
    })),
    procedures: (Array.isArray(source?.procedures) ? source.procedures : []).map(normalizeProcedure),
    days: (Array.isArray(source?.days) ? source.days : []).map((day) => ({
      workplaceId: String(day?.workplaceId ?? ''),
      date: String(day?.date || '').slice(0, 10),
      from: String(day?.from || ''),
      to: String(day?.to || ''),
    })),
    occupancy: (Array.isArray(source?.occupancy) ? source.occupancy : []).map((usage) => ({
      id: String(usage?.id || ''),
      workplaceId: String(usage?.workplaceId ?? ''),
      date: String(usage?.date || '').slice(0, 10),
      from: String(usage?.from || ''),
      to: String(usage?.to || ''),
      type: String(usage?.type || 'usage'),
    })),
    slotStep: Math.max(0, Number(source?.settings?.slotStep) || 0),
  };
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
  const payload = await request(`/online-booking/${encodeURIComponent(id)}/context${suffix}`);
  return normalizeContext(payload);
}

export async function createPlatformRecord(professionalId, data = {}) {
  const id = String(professionalId || '').trim();
  if (!id) throw new Error('Профессионал не выбран');
  return request(`/online-booking/${encodeURIComponent(id)}/requests`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
