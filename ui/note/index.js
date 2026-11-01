import { v2HorizontalRail } from '../v2/index.js';
import { escapeHtml } from '../utils/escape-html.js';

export const NOTE_DEFAULT_COLOR = '#CFC3FF';

function validColor(value = '') {
  const color = String(value || '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : NOTE_DEFAULT_COLOR;
}

function dateLabel(value = '') {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

export function orderNoteReels(notes = []) {
  return Array.isArray(notes) ? [...notes] : [];
}

function noteSticker(note = {}, {
  variant = 'compact',
  interactive = false,
  dataAttribute = '',
  related = false,
  targetLabel = '',
  showDate = false,
} = {}) {
  const title = String(note?.title || '').trim();
  const body = String(note?.text || '').trim();
  const date = dateLabel(note?.date);
  const color = validColor(note?.color);
  const summary = title || body || 'Заметка';
  const classes = [
    'note-sticker',
    `note-sticker--${variant}`,
    related ? 'is-related' : '',
  ].filter(Boolean).join(' ');
  const target = targetLabel ? `<span class="note-sticker__target">${escapeHtml(targetLabel)}</span>` : '';
  const dateNode = showDate && date ? `<span class="note-sticker__date">${escapeHtml(date)}</span>` : '';
  const content = `<span class="note-sticker__tape" aria-hidden="true"></span>
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

export function noteCard(note = {}, { related = false, targetLabel = '' } = {}) {
  const id = String(note?.id || '');
  return noteSticker(note, {
    variant: 'compact',
    interactive: true,
    dataAttribute: `data-note-reel="${escapeHtml(id)}"`,
    related,
    targetLabel,
  });
}

export function noteReels(notes = [], { relatedIds = [], targetLabel = () => '' } = {}) {
  const values = orderNoteReels(notes);
  if (!values.length) return '';
  const related = new Set((Array.isArray(relatedIds) ? relatedIds : [relatedIds]).map((id) => String(id || '')).filter(Boolean));
  const cards = values.map((note) => noteCard(note, {
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
