import { actionBlock } from '../ui/page/page.js';
import { button } from '../ui/buttons/index.js';
import { field, textareaField } from '../ui/inputs/index.js';
import { timePicker, initTimePickers } from '../ui/time/index.js';
import { colorPicker, initColorPickers } from '../ui/colors/index.js';
import { modal, mountModal, openNotice } from '../ui/modals/index.js';
import { escapeHtml } from '../ui/utils/escape-html.js';

function minutes(value = '') {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function openUserEventView(eventOrId, { eventActions, onClose = () => {} } = {}) {
  if (!eventActions?.read || !eventActions?.update || !eventActions?.remove) return null;
  const eventId = String(typeof eventOrId === 'object' ? eventOrId?.id : eventOrId || '');
  let current = eventActions.read(eventId);
  if (!current) return null;

  const layer = mountModal(document.body, modal('<div data-user-event-view></div>', {
    variant: 'q',
    surface: 'app',
    title: 'Событие',
  }));
  if (!layer) return null;
  const close = layer.v2Close?.bind(layer);
  if (close) layer.v2Close = () => { if (layer.isConnected) { close(); onClose(); } };
  const host = () => layer.querySelector('[data-user-event-view]');

  const renderRead = () => {
    current = eventActions.read(eventId);
    const root = host();
    if (!root || !current) return;
    root.innerHTML = `<section class="form-grid event-view">
      <div><strong>${escapeHtml(current.title || 'Событие')}</strong></div>
      <div>${escapeHtml(current.date || '')}</div>
      <div><strong>С ${escapeHtml(current.from || '')} — До ${escapeHtml(current.to || '')}</strong></div>
      <div class="color-picker__swatch" style="background:${escapeHtml(current.color || '#777A7D')}"></div>
      ${current.description ? `<div class="event-view__description">${escapeHtml(current.description).replace(/\n/g, '<br>')}</div>` : ''}
      ${actionBlock(`${button('Изменить', { data: 'data-user-event-edit' })}${button('Удалить', { variant: 'critical', data: 'data-user-event-delete' })}`)}
    </section>`;
    root.querySelector('[data-user-event-edit]')?.addEventListener('click', renderEdit);
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
      ${field({ label: 'Наименование', name: 'title', value: current.title, required: true })}
      ${textareaField({ label: 'Описание', name: 'description', value: current.description, rows: 6 })}
      <div class="time-range-fields">
        ${timePicker({ label: 'С', name: 'from', value: current.from, minuteStep: 1 })}
        ${timePicker({ label: 'До', name: 'to', value: current.to, minuteStep: 1 })}
      </div>
      ${colorPicker({ name: 'color', value: current.color || '#777A7D' })}
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
