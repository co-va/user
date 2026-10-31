import { field, textareaField } from '../ui/inputs/index.js';
import { timePicker, initTimePickers } from '../ui/time/index.js';
import { colorPicker, initColorPickers } from '../ui/colors/index.js';
import { openNotice } from '../ui/modals/index.js';

function minutes(value = '') {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function initialTo(from = '09:00') {
  const start = minutes(from);
  if (start == null) return '09:30';
  const next = Math.min(23 * 60 + 59, start + 30);
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

export function createUserEventFlow({ owner, date, timeHint = '', eventActions, onCreated = () => {} } = {}) {
  if (!owner || typeof eventActions?.create !== 'function') return null;
  const state = {
    date: String(date || '').slice(0, 10),
    from: String(timeHint || '09:00').slice(0, 5),
    to: initialTo(String(timeHint || '09:00').slice(0, 5)),
    title: '',
    description: '',
    color: '#777A7D',
  };

  const render = () => {
    const view = owner.render({
      step: 'event',
      title: false,
      body: `<form class="form-grid" data-user-event-create>
        ${field({ label: 'Наименование', name: 'title', value: state.title, required: true })}
        ${textareaField({ label: 'Описание', name: 'description', value: state.description, rows: 6 })}
        <div class="time-range-fields">
          ${timePicker({ label: 'С', name: 'from', value: state.from, minuteStep: 1 })}
          ${timePicker({ label: 'До', name: 'to', value: state.to, minuteStep: 1 })}
        </div>
        ${colorPicker({ name: 'color', value: state.color })}
      </form>`,
      action: { label: 'Создать', data: 'data-user-event-create-submit' },
    });
    if (!view) return;
    initTimePickers(view.body);
    initColorPickers(view.body);
    view.action?.addEventListener('click', async (event) => {
      const form = view.body.querySelector('[data-user-event-create]');
      const data = form ? new FormData(form) : new FormData();
      const input = {
        date: state.date,
        from: String(data.get('from') || state.from).slice(0, 5),
        to: String(data.get('to') || state.to).slice(0, 5),
        title: String(data.get('title') || '').trim(),
        description: String(data.get('description') || '').trim(),
        color: String(data.get('color') || state.color),
      };
      if (!input.title) return openNotice({ title: 'Событие', message: 'Укажите наименование события.' });
      if (minutes(input.from) == null || minutes(input.to) == null || minutes(input.to) <= minutes(input.from)) {
        return openNotice({ title: 'Событие', message: 'Время окончания должно быть позже времени начала.' });
      }
      const submit = event.currentTarget;
      submit.disabled = true;
      try {
        const created = await eventActions.create(input);
        if (!created) throw new Error('Не удалось создать событие.');
        owner.commit?.();
        onCreated(created);
      } catch (error) {
        openNotice({ title: 'Не удалось создать событие', message: String(error?.message || 'Сервер не подтвердил сохранение.') });
        if (submit.isConnected) submit.disabled = false;
      }
    });
  };

  render();
  return { resume: render, getState: () => ({ ...state }) };
}
