import { datePicker, initDatePickers } from '../ui/calendar/index.js';
import { field, textareaField } from '../ui/inputs/index.js';
import { colorPicker, initColorPickers } from '../ui/colors/index.js';
import { select } from '../ui/selectors/index.js';
import { openNotice } from '../ui/modals/index.js';
import { NOTE_DEFAULT_COLOR } from '../ui/note/index.js';
import {
  noteContextWithTarget,
  noteTargetOptions,
  noteTargetValue,
  parseNoteTargetValue,
} from './note-target.js';

export function createUserNoteFlow({ owner, date, noteActions, targetSource = null, onCreated = () => {} } = {}) {
  if (!owner || typeof noteActions?.create !== 'function') return null;
  const state = {
    date: String(date || '').slice(0, 10),
    targetType: '',
    targetId: '',
    title: '',
    text: '',
    color: NOTE_DEFAULT_COLOR,
  };

  const render = () => {
    owner.setShellHeader?.('<div class="record-creation-step-title user-note-shell-title" style="position:absolute;top:0;left:52px;height:24px;display:flex;align-items:center;margin:0;font-size:20px;line-height:24px;font-weight:500">Заметка</div>');
    const view = owner.render({
      step: 'note',
      title: false,
      body: `<form class="form-grid" data-user-note-create>
        <div class="user-note-color-picker">${colorPicker({ name: 'color', value: state.color })}</div>
        ${datePicker({ label: 'Дата', name: 'date', value: state.date, required: true, allowClear: false })}
        ${select({ label: 'Прикрепить к', name: 'target', value: noteTargetValue(state), options: noteTargetOptions(state.date, { source: targetSource }), aria: 'Прикрепить заметку' })}
        ${field({ label: 'Наименование', name: 'title', value: state.title })}
        ${textareaField({ label: 'Текст', name: 'text', value: state.text, rows: 8, placeholder: 'Текст заметки' })}
      </form>`,
      action: { label: 'Создать', data: 'data-user-note-create-submit' },
    });
    if (!view) return;
    initDatePickers(view.body);
    initColorPickers(view.body);
    view.action?.addEventListener('click', async (event) => {
      const form = view.body.querySelector('[data-user-note-create]');
      const data = form ? new FormData(form) : new FormData();
      const target = parseNoteTargetValue(data.get('target'));
      const input = {
        context: noteContextWithTarget({ scope: 'account' }, target.targetType, target.targetId, { source: targetSource }),
        date: String(data.get('date') || state.date || '').slice(0, 10),
        targetType: target.targetType,
        targetId: target.targetId,
        title: String(data.get('title') || '').trim(),
        text: String(data.get('text') || '').trim(),
        color: String(data.get('color') || NOTE_DEFAULT_COLOR),
      };
      if (!input.date) return openNotice({ title: 'Заметка', message: 'Укажите дату заметки.' });
      if (!input.title && !input.text) return openNotice({ title: 'Заметка', message: 'Укажите наименование или текст заметки.' });
      const submit = event.currentTarget;
      submit.disabled = true;
      try {
        const created = await noteActions.create(input);
        if (!created) throw new Error('Не удалось создать заметку.');
        owner.commit?.();
        onCreated(created);
      } catch (error) {
        openNotice({ title: 'Не удалось создать заметку', message: String(error?.message || 'Сервер не подтвердил сохранение.') });
        if (submit.isConnected) submit.disabled = false;
      }
    });
  };

  render();
  return { resume: render, getState: () => ({ ...state }) };
}
