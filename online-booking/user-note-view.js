import { actionBlock } from '../ui/page/page.js';
import { button } from '../ui/buttons/index.js';
import { datePicker, initDatePickers } from '../ui/calendar/index.js';
import { field, textareaField } from '../ui/inputs/index.js';
import { timePicker, initTimePickers } from '../ui/time/index.js';
import { colorPicker, initColorPickers } from '../ui/colors/index.js';
import { select } from '../ui/selectors/index.js';
import { modal, mountModal, openNotice } from '../ui/modals/index.js';
import { NOTE_DEFAULT_COLOR, noteDetail } from '../ui/note/index.js';
import {
  noteContextWithTarget,
  noteTargetLabel,
  noteTargetOptions,
  noteTargetValue,
  parseNoteTargetValue,
} from './user-note-target.js';

export function openUserNoteView(noteOrId, {
  noteActions,
  targetSource = null,
  onClose = () => {},
  onSaved = () => {},
  onDeleted = () => {},
} = {}) {
  if (!noteActions?.read || !noteActions?.update || !noteActions?.remove) return null;
  const noteId = String(typeof noteOrId === 'object' ? noteOrId?.id : noteOrId || '');
  let current = noteActions.read(noteId);
  if (!current) return null;

  const layer = mountModal(document.body, modal('<div data-user-note-view></div>', {
    variant: 'q',
    surface: 'app',
    title: 'Заметка',
  }));
  if (!layer) return null;
  const close = layer.v2Close?.bind(layer);
  if (close) layer.v2Close = () => { if (layer.isConnected) { close(); onClose(); } };
  const host = () => layer.querySelector('[data-user-note-view]');

  const renderRead = () => {
    current = noteActions.read(noteId);
    const root = host();
    if (!root || !current) return;
    root.innerHTML = `${noteDetail(current, { targetLabel: noteTargetLabel(current, { source: targetSource }) })}${actionBlock(button('Изменить', { data: 'data-user-note-edit' }))}`;
    root.querySelector('[data-user-note-edit]')?.addEventListener('click', renderEdit);
  };

  const renderEdit = () => {
    current = noteActions.read(noteId);
    const root = host();
    if (!root || !current) return;
    root.innerHTML = `<form class="form-grid" data-user-note-edit-form>
      ${datePicker({ label: 'Дата', name: 'date', value: current.date, required: true, allowClear: false })}
      <div class="time-range-fields">
        ${timePicker({ label: 'С', name: 'from', value: current.from, allowEmpty: true, minuteStep: 1 })}
        ${timePicker({ label: 'До', name: 'to', value: current.to, allowEmpty: true, minuteStep: 1 })}
      </div>
      ${select({ label: 'Прикрепить к', name: 'target', value: noteTargetValue(current), options: noteTargetOptions(current.date, { includeNote: current, source: targetSource }), aria: 'Прикрепить заметку' })}
      ${field({ label: 'Наименование', name: 'title', value: current.title })}
      ${textareaField({ label: 'Текст', name: 'text', value: current.text, rows: 8, placeholder: 'Текст заметки' })}
      ${colorPicker({ name: 'color', value: current.color || NOTE_DEFAULT_COLOR })}
      ${actionBlock(`${button('Сохранить', { type: 'submit' })}${button('Удалить', { variant: 'critical', data: 'data-user-note-delete' })}${button('Отмена', { variant: 'secondary', data: 'data-user-note-cancel' })}`)}
    </form>`;
    initDatePickers(root);
    initTimePickers(root);
    initColorPickers(root);
    root.querySelector('[data-user-note-cancel]')?.addEventListener('click', renderRead);
    root.querySelector('[data-user-note-edit-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const target = parseNoteTargetValue(data.get('target'));
      const patch = {
        context: noteContextWithTarget(current.context || {}, target.targetType, target.targetId, { source: targetSource }),
        date: String(data.get('date') || '').slice(0, 10),
        from: String(data.get('from') || '').slice(0, 5),
        to: String(data.get('to') || '').slice(0, 5),
        targetType: target.targetType,
        targetId: target.targetId,
        title: String(data.get('title') || '').trim(),
        text: String(data.get('text') || '').trim(),
        color: String(data.get('color') || NOTE_DEFAULT_COLOR),
      };
      if (!patch.date) return openNotice({ title: 'Заметка', message: 'Укажите дату заметки.' });
      if (!patch.title && !patch.text) return openNotice({ title: 'Заметка', message: 'Укажите наименование или текст заметки.' });
      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const updated = await noteActions.update(noteId, patch);
        if (!updated) throw new Error('Не удалось сохранить заметку.');
        current = updated;
        onSaved(updated);
        renderRead();
      } catch (error) {
        openNotice({ title: 'Не удалось сохранить заметку', message: String(error?.message || 'Сервер не подтвердил изменения.') });
        if (submit?.isConnected) submit.disabled = false;
      }
    });
    root.querySelector('[data-user-note-delete]')?.addEventListener('click', async (event) => {
      const submit = event.currentTarget;
      submit.disabled = true;
      const snapshot = noteActions.read(noteId);
      try {
        const removed = await noteActions.remove(noteId);
        if (!removed) throw new Error('Не удалось удалить заметку.');
        onDeleted(snapshot);
        layer.v2Close?.();
      } catch (error) {
        openNotice({ title: 'Не удалось удалить заметку', message: String(error?.message || 'Сервер не подтвердил удаление.') });
        if (submit.isConnected) submit.disabled = false;
      }
    });
  };

  renderRead();
  return layer;
}
