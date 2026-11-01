import { v2HorizontalRail } from '../v2/index.js';
import { escapeHtml } from '../utils/escape-html.js';

export const NOTE_DEFAULT_COLOR = '#CFC3FF';

function validColor(value = '') {
  const color = String(value || '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : NOTE_DEFAULT_COLOR;
}

function timeLabel(note = {}) {
  const from = String(note?.from || '');
  const to = String(note?.to || '');
  if (from && to) return `${from}–${to}`;
  return from || to || '';
}

function dateLabel(value = '') {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function minutes(value = '') {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function noteActivationMinute(note = {}, activeTime = '') {
  const active = minutes(activeTime);
  const from = minutes(note?.from);
  const to = minutes(note?.to);
  if (active == null) return -1;
  if (from != null && to == null) return from;
  if (from == null && to != null) return to;
  if (from == null || to == null) return -1;
  if (from <= to) return from;
  return active >= from ? from : from - (24 * 60);
}

export function noteIsActiveAt(note = {}, activeTime = '') {
  const active = minutes(activeTime);
  if (active == null) return false;
  const from = minutes(note?.from);
  const to = minutes(note?.to);
  if (from == null && to == null) return false;
  if (from != null && to == null) return active === from;
  if (from == null && to != null) return active === to;
  if (from <= to) return active >= from && active <= to;
  return active >= from || active <= to;
}

export function orderNoteReels(notes = [], activeTime = '') {
  return (Array.isArray(notes) ? notes : [])
    .map((note, index) => ({ note, index, active: noteIsActiveAt(note, activeTime), activation: noteActivationMinute(note, activeTime) }))
    .sort((left, right) => {
      if (left.active !== right.active) return left.active ? -1 : 1;
      if (left.active && left.activation !== right.activation) return right.activation - left.activation;
      return left.index - right.index;
    })
    .map((item) => item.note);
}

function noteSticker(note = {}, {
  variant = 'compact',
  interactive = false,
  dataAttribute = '',
  active = false,
  related = false,
  targetLabel = '',
  showDate = false,
  showLegacyTime = false,
} = {}) {
  const id = String(note?.id || '');
  const title = String(note?.title || '').trim();
  const body = String(note?.text || '').trim();
  const date = dateLabel(note?.date);
  const legacyTime = showLegacyTime ? timeLabel(note) : '';
  const color = validColor(note?.color);
  const summary = title || body || 'Заметка';
  const classes = [
    'note-sticker',
    `note-sticker--${variant}`,
    active ? 'is-time-active' : '',
    related ? 'is-related' : '',
  ].filter(Boolean).join(' ');
  const target = targetLabel ? `<span class="note-sticker__target">${escapeHtml(targetLabel)}</span>` : '';
  const meta = legacyTime ? `<span class="note-sticker__meta">${escapeHtml(legacyTime)}</span>` : '';
  const dateNode = showDate && date ? `<span class="note-sticker__date">${escapeHtml(date)}</span>` : '';
  const content = `<span class="note-sticker__tape" aria-hidden="true"></span>
    ${meta}
    ${target}
    ${title ? `<strong class="note-sticker__title">${escapeHtml(title)}</strong>` : ''}
    ${body ? `<span class="note-sticker__text">${escapeHtml(body)}</span>` : ''}
    ${dateNode}`;
  const style = `--note-color:${escapeHtml(color)}`;

  if (interactive) {
    return `<button type="button" class="${classes}" ${dataAttribute} style="${style}" aria-label="Открыть заметку ${escapeHtml(summary)}">${content}</button>`;
  }
  return `<article class="${classes}" style="${style}">${content}</article>`;
}

export function noteCard(note = {}, { active = false, related = false, targetLabel = '' } = {}) {
  const id = String(note?.id || '');
  return noteSticker(note, {
    variant: 'compact',
    interactive: true,
    dataAttribute: `data-note-reel="${escapeHtml(id)}"`,
    active,
    related,
    targetLabel,
    showLegacyTime: true,
  });
}

export function noteReels(notes = [], { activeTime = '', relatedIds = [], targetLabel = () => '' } = {}) {
  const values = orderNoteReels(notes, activeTime);
  if (!values.length) return '';
  const related = new Set((Array.isArray(relatedIds) ? relatedIds : [relatedIds]).map((id) => String(id || '')).filter(Boolean));
  const cards = values.map((note) => noteCard(note, {
    active: noteIsActiveAt(note, activeTime),
    related: related.has(String(note?.id || '')),
    targetLabel: targetLabel(note),
  })).join('');
  return `<section class="note-reels" aria-label="Заметки">${v2HorizontalRail(cards, { className: 'note-reels__rail' })}</section>`;
}

export function initNoteReels(root, { onOpen = () => {} } = {}) {
  root?.querySelectorAll?.('[data-note-reel]').forEach((node) => {
    node.addEventListener('click', () => {
      const noteId = String(node.dataset.noteReel || '');
      if (noteId) onOpen({ noteId });
    });
  });
}

export function focusNoteReels(root, noteIds = []) {
  const values = new Set((Array.isArray(noteIds) ? noteIds : [noteIds]).map((id) => String(id || '')).filter(Boolean));
  if (!root || !values.size) return null;
  let first = null;
  root.querySelectorAll?.('[data-note-reel]').forEach((node) => {
    const focused = values.has(String(node.dataset.noteReel || ''));
    node.classList.toggle('is-related', focused);
    if (focused && !first) first = node;
  });
  first?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  return first;
}

export function noteDetail(note = {}) {
  return `<section class="note-detail">${noteSticker(note, {
    variant: 'full',
    showDate: true,
  })}</section>`;
}

export function noteAttachmentSticker(note = {}) {
  const id = String(note?.id || '');
  if (!id) return '';
  return noteSticker(note, {
    variant: 'mini',
    interactive: true,
    dataAttribute: `data-note-attachment="${escapeHtml(id)}"`,
  });
}

export function noteAttachmentStickers(notes = []) {
  const content = (Array.isArray(notes) ? notes : []).map(noteAttachmentSticker).filter(Boolean).join('');
  return content ? `<div class="note-attachment-stickers" aria-label="Прикреплённые заметки">${content}</div>` : '';
}
