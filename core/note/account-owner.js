import { accountRequest } from '../account/index.js';

const NOTE_DEFAULT_COLOR = '#CFC3FF';
let rows = [];
let loaded = false;
let loading = null;

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function normalize(value = {}) {
  const now = new Date().toISOString();
  const targetType = value?.targetType === 'record' || value?.targetType === 'event'
    ? String(value.targetType)
    : '';
  const targetId = targetType ? String(value?.targetId || '') : '';
  return {
    id: String(value?.id || ''),
    ownerType: 'account',
    ownerId: String(value?.ownerId || ''),
    context: value?.context && typeof value.context === 'object' && !Array.isArray(value.context)
      ? { ...clone(value.context), scope: 'account' }
      : { scope: 'account' },
    date: String(value?.date || '').slice(0, 10),
    targetType,
    targetId,
    title: String(value?.title || ''),
    text: String(value?.text || ''),
    color: /^#[0-9A-Fa-f]{6}$/.test(String(value?.color || ''))
      ? String(value.color).toUpperCase()
      : NOTE_DEFAULT_COLOR,
    createdAt: String(value?.createdAt || now),
    updatedAt: String(value?.updatedAt || value?.createdAt || now),
  };
}

function noteId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function replaceRow(value) {
  const note = normalize(value);
  const index = rows.findIndex((item) => item.id === note.id);
  if (index >= 0) rows[index] = note;
  else rows.push(note);
  return clone(note);
}

export function accountNotesLoaded() { return loaded; }
export function getAccountNotes() { return rows.map(clone); }
export function getAccountNote(id) {
  const row = rows.find((item) => item.id === String(id || ''));
  return row ? clone(row) : null;
}
export function getAccountNotesForDay(date) {
  const day = String(date || '').slice(0, 10);
  return getAccountNotes().filter((note) => note.date === day);
}

export async function loadAccountNotes({ force = false } = {}) {
  if (loaded && !force) return getAccountNotes();
  if (loading && !force) return loading;
  loading = accountRequest('/account/notes', { auth: true }, 'Не удалось загрузить заметки.')
    .then((payload) => {
      rows = (Array.isArray(payload) ? payload : []).map(normalize).filter((item) => item.id);
      loaded = true;
      return getAccountNotes();
    })
    .finally(() => { loading = null; });
  return loading;
}

export async function createAccountNote(input = {}) {
  const note = normalize({
    ...input,
    id: String(input?.id || noteId()),
    ownerType: 'account',
    context: { ...(input?.context || {}), scope: 'account' },
  });
  const saved = await accountRequest(
    `/account/notes/${encodeURIComponent(note.id)}`,
    {
      auth: true,
      method: 'PUT',
      body: JSON.stringify({ note }),
    },
    'Сервер не подтвердил сохранение заметки.',
  );
  loaded = true;
  return replaceRow(saved);
}

export async function updateAccountNote(id, patch = {}) {
  const current = getAccountNote(id);
  if (!current) throw new Error('Заметка не найдена.');
  const note = normalize({
    ...current,
    ...clone(patch),
    id: current.id,
    ownerType: 'account',
    ownerId: current.ownerId,
    createdAt: current.createdAt,
    context: { ...(current.context || {}), ...(patch?.context || {}), scope: 'account' },
  });
  const saved = await accountRequest(
    `/account/notes/${encodeURIComponent(current.id)}`,
    {
      auth: true,
      method: 'PUT',
      body: JSON.stringify({ note }),
    },
    'Сервер не подтвердил сохранение заметки.',
  );
  loaded = true;
  return replaceRow(saved);
}

export async function removeAccountNote(id) {
  const key = String(id || '');
  if (!key) return false;
  await accountRequest(
    `/account/notes/${encodeURIComponent(key)}`,
    { auth: true, method: 'DELETE' },
    'Не удалось удалить заметку.',
  );
  rows = rows.filter((item) => item.id !== key);
  loaded = true;
  return true;
}

export const accountNoteActions = {
  read: getAccountNote,
  create: createAccountNote,
  update: updateAccountNote,
  remove: removeAccountNote,
};
