import { accountRequest, getAccountToken } from '../account/index.js';

let recordContactsPending = null;
let recordContactsToken = '';

function normalizePrice(source = {}) {
  return {
    minimum: Math.max(0, Number(source?.minimum) || 0),
    variable: Boolean(source?.variable),
    free: Boolean(source?.free),
    // Preserve a display-ready price when the source supplies it.
    display: String(source?.display || source?.label || '').trim(),
  };
}

function normalizeProcedure(source = {}) {
  return {
    id: String(source?.id || ''),
    name: String(source?.name || ''),
    duration: Math.max(0, Number(source?.duration) || 0),
    workplaces: (Array.isArray(source?.workplaces) ? source.workplaces : []).map((workplace) => ({
      workplaceId: String(workplace?.workplaceId ?? workplace?.key ?? workplace?.id ?? ''),
      price: normalizePrice(workplace?.price),
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

export async function getRecordContacts() {
  const token = getAccountToken();
  if (recordContactsPending && recordContactsToken === token) return recordContactsPending;
  recordContactsToken = token;
  const pending = accountRequest('/account/record-targets', { auth: true }, 'Не удалось загрузить контакты')
    .then((payload) => Array.isArray(payload) ? payload : []);
  recordContactsPending = pending;
  try {
    return await pending;
  } finally {
    if (recordContactsPending === pending) {
      recordContactsPending = null;
      recordContactsToken = '';
    }
  }
}

export async function getContactRecordContext(contactId, workplaceKey = '') {
  const id = String(contactId || '').trim();
  if (!id) throw new Error('Контакт не выбран');
  const params = new URLSearchParams();
  if (workplaceKey) params.set('workplace', workplaceKey);
  const suffix = params.toString() ? `?${params}` : '';
  const payload = await accountRequest(
    `/account/contacts/${encodeURIComponent(id)}/record-context${suffix}`,
    { auth: true },
    'Не удалось загрузить запись',
  );
  return normalizeContext(payload);
}

export async function createContactRecord(contactId, data = {}) {
  const id = String(contactId || '').trim();
  if (!id) throw new Error('Контакт не выбран');
  return accountRequest(
    `/account/contacts/${encodeURIComponent(id)}/records`,
    {
      auth: true,
      method: 'POST',
      body: JSON.stringify(data),
    },
    'Не удалось создать запись',
  );
}
