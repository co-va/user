import { actionBlock } from '../ui/page/page.js';
import { button } from '../ui/buttons/index.js';
import { field, textareaField } from '../ui/inputs/index.js';
import { timePicker, initTimePickers } from '../ui/time/index.js';
import { colorPicker, initColorPickers } from '../ui/colors/index.js';
import { modal, mountModal, openNotice } from '../ui/modals/index.js';
import { noteAttachmentStickers } from '../ui/note/index.js';
import { escapeHtml } from '../ui/utils/escape-html.js';
import { accountNoteActions, getAccountNotes } from '../core/note/account-owner.js';
import { openUserNoteView } from './note-view.js';

function minutes(value = '') {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function dateLabel(value = '') {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function notesForEvent(eventId = '') {
  const id = String(eventId || '');
  return getAccountNotes().filter((note) => note?.targetType === 'event' && String(note?.targetId || '') === id);
}

export function openUserEventView(eventOrId, { eventActions, onClose = () => {} } = {}) {
  if (!eventActions?.read || !eventActions?.update || !eventActions?.remove) return null;
  const eventId = String(typeof eventOrId === 'object' ? eventOrId?.id : eventOrId || '');
  let current = eventActions.read(eventId);
  if (!current) return null;

  const layer = mountModal(document.body, modal('<div data-user-event-view></div>', {
    variant: 'q',
    surface: 'app',
    className: 'user-event-detail-q',
  }));
  if (!layer) return null;
  layer.setAttribute('aria-label', 'Событие');
  const close = layer.v2Close?.bind(layer);
  if (close) layer.v2Close = () => { if (layer.isConnected) { close(); onClose(); } };
  const host = () => layer.querySelector('[data-user-event-view]');

  const renderRead = () => {
    current = eventActions.read(eventId);
    const root = host();
    if (!root || !current) return;
    const attachedNotes = notesForEvent(eventId);
    const color = /^#[0-9A-F]{6}$/i.test(String(current.color || '')) ? current.color : '#777A7D';
    root.innerHTML = `<section class="note-detail event-detail">
      <article class="note-sticker note-sticker--event" style="--note-color:${escapeHtml(color)}">
        <strong class="note-sticker__title">${escapeHtml(current.title || 'Событие')}</strong>
        ${current.description ? `<div class="note-sticker__text">${escapeHtml(current.description)}</div>` : ''}
        <div class="event-sticker__meta">
          <span class="note-sticker__date">${escapeHtml(dateLabel(current.date || ''))}</span>
          <span class="note-sticker__date">${escapeHtml(current.from || '')}–${escapeHtml(current.to || '')}</span>
        </div>
      </article>
      ${noteAttachmentStickers(attachedNotes)}
    </section>
    ${actionBlock(`${button('Изменить', { data: 'data-user-event-edit' })}${button('Удалить', { variant: 'danger', data: 'data-user-event-delete' })}`)}`;
    root.querySelector('[data-user-event-edit]')?.addEventListener('click', renderEdit);
    root.querySelectorAll('[data-note-attachment]').forEach((node) => node.addEventListener('click', () => {
      const noteId = String(node.dataset.noteAttachment || '');
      const note = attachedNotes.find((item) => String(item?.id || '') === noteId);
      if (!note) return;
      openUserNoteView(note, {
        noteActions: accountNoteActions,
        onSaved: renderRead,
        onDeleted: renderRead,
      });
    }));
    root.querySelector('[data-user-event-delete]')?.addEventListener('click', async (event) => {
      const submit = event.currentTarget;
      submit.disabled = true;
      try {
        await eventActions.remove(eventId);
        layer.v2Close?.();
      } catch (error) {
        openNotice({ title: 'Не удалось удалить событие', message: String(error?.message || 'Сервер не подтвердил удаление.') });
        if (submit.isConnected) submit.disabled = false;
      }
    });
  };

  const renderEdit = () => {
    current = eventActions.read(eventId);
    const root = host();
    if (!root || !current) return;
    root.innerHTML = `<form class="form-grid" data-user-event-edit-form>
      <div class="user-event-color-picker">${colorPicker({ name: 'color', value: current.color || '#777A7D' })}</div>
      <div class="time-range-fields">
        ${timePicker({ label: 'С', name: 'from', value: current.from, minuteStep: 1 })}
        ${timePicker({ label: 'До', name: 'to', value: current.to, minuteStep: 1 })}
      </div>
      ${field({ label: 'Наименование', name: 'title', value: current.title, required: true })}
      ${textareaField({ label: 'Описание', name: 'description', value: current.description, rows: 6 })}
      ${actionBlock(`${button('Сохранить', { type: 'submit' })}${button('Отмена', { variant: 'secondary', data: 'data-user-event-cancel' })}`)}
    </form>`;
    initTimePickers(root);
    initColorPickers(root);
    root.querySelector('[data-user-event-cancel]')?.addEventListener('click', renderRead);
    root.querySelector('[data-user-event-edit-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const title = String(data.get('title') || '').trim();
      const from = String(data.get('from') || '').slice(0, 5);
      const to = String(data.get('to') || '').slice(0, 5);
      if (!title) return openNotice({ title: 'Событие', message: 'Укажите наименование события.' });
      const start = minutes(from), end = minutes(to);
      if (start == null || end == null || end <= start) return openNotice({ title: 'Событие', message: 'Проверьте время события.' });
      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        await eventActions.update(eventId, {
          title,
          description: String(data.get('description') || '').trim(),
          from,
          to,
          color: String(data.get('color') || '#777A7D'),
        });
        renderRead();
      } catch (error) {
        openNotice({ title: 'Не удалось сохранить событие', message: String(error?.message || 'Сервер не подтвердил изменения.') });
        if (submit?.isConnected) submit.disabled = false;
      }
    });
  };

  renderRead();
  return layer;
}
