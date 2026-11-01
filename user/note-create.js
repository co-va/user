import { openNotice } from '../ui/modals/index.js';
import { NOTE_DEFAULT_COLOR } from '../ui/note/index.js';
import {
  initUserNoteEditor,
  readUserNoteEditor,
  userNoteEditorMarkup,
} from './note-editor.js';

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
      body: userNoteEditorMarkup(state, {
        targetSource,
        formData: 'data-user-note-create',
      }),
      action: { label: 'Создать', data: 'data-user-note-create-submit' },
    });
    if (!view) return;
    initUserNoteEditor(view.body);
    view.action?.addEventListener('click', async (event) => {
      const form = view.body.querySelector('[data-user-note-create]');
      const input = readUserNoteEditor(form, {
        currentContext: { scope: 'account' },
        targetSource,
        fallbackDate: state.date,
      });
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
