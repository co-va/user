import { actionBlock } from '../ui/page/page.js';
import { button } from '../ui/buttons/index.js';
import { modal, mountModal, openNotice } from '../ui/modals/index.js';
import { noteDetail } from '../ui/note/index.js';
import {
  initUserNoteEditor,
  readUserNoteEditor,
  userNoteEditorMarkup,
} from './note-editor.js';

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
    className: 'user-note-detail-q',
  }));
  if (!layer) return null;
  layer.setAttribute('aria-label', 'Заметка');
  const close = layer.v2Close?.bind(layer);
  if (close) layer.v2Close = () => { if (layer.isConnected) { close(); onClose(); } };
  const host = () => layer.querySelector('[data-user-note-view]');
  const headerHost = layer.querySelector('[data-v2-q-header-content]');

  const setEditorHeader = (visible) => {
    if (!headerHost) return;
    headerHost.innerHTML = visible
      ? '<div class="user-note-shell-title" style="position:absolute;top:0;left:52px;height:24px;display:flex;align-items:center;margin:0;font-size:20px;line-height:24px;font-weight:500">Заметка</div>'
      : '';
  };

  const removeNote = async (control) => {
    control.disabled = true;
    const snapshot = noteActions.read(noteId);
    try {
      const removed = await noteActions.remove(noteId);
      if (!removed) throw new Error('Не удалось удалить заметку.');
      onDeleted(snapshot);
      layer.v2Close?.();
    } catch (error) {
      openNotice({ title: 'Не удалось удалить заметку', message: String(error?.message || 'Сервер не подтвердил удаление.') });
      if (control.isConnected) control.disabled = false;
    }
  };

  const renderRead = () => {
    current = noteActions.read(noteId);
    const root = host();
    if (!root || !current) return;
    setEditorHeader(false);
    root.innerHTML = `${noteDetail(current)}${actionBlock(`${button('Изменить', { data: 'data-user-note-edit' })}${button('Удалить', { variant: 'danger', data: 'data-user-note-delete' })}`)}`;
    root.querySelector('[data-user-note-edit]')?.addEventListener('click', renderEdit);
    root.querySelector('[data-user-note-delete]')?.addEventListener('click', (event) => removeNote(event.currentTarget));
  };

  const renderEdit = () => {
    current = noteActions.read(noteId);
    const root = host();
    if (!root || !current) return;
    setEditorHeader(true);
    root.innerHTML = `${userNoteEditorMarkup(current, {
      targetSource,
      includeNote: current,
      formData: 'data-user-note-edit-form',
    })}${actionBlock(`${button('Сохранить', { type: 'submit', data: 'data-user-note-save' })}${button('Отмена', { variant: 'secondary', data: 'data-user-note-cancel' })}`)}`;
    initUserNoteEditor(root);
    root.querySelector('[data-user-note-cancel]')?.addEventListener('click', renderRead);
    root.querySelector('[data-user-note-save]')?.addEventListener('click', async (event) => {
      const form = root.querySelector('[data-user-note-edit-form]');
      const patch = readUserNoteEditor(form, {
        currentContext: current.context || { scope: 'account' },
        targetSource,
        fallbackDate: current.date,
      });
      if (!patch.date) return openNotice({ title: 'Заметка', message: 'Укажите дату заметки.' });
      if (!patch.title && !patch.text) return openNotice({ title: 'Заметка', message: 'Укажите наименование или текст заметки.' });
      const submit = event.currentTarget;
      submit.disabled = true;
      try {
        const updated = await noteActions.update(noteId, patch);
        if (!updated) throw new Error('Не удалось сохранить заметку.');
        current = updated;
        onSaved(updated);
        renderRead();
      } catch (error) {
        openNotice({ title: 'Не удалось сохранить заметку', message: String(error?.message || 'Сервер не подтвердил изменения.') });
        if (submit.isConnected) submit.disabled = false;
      }
    });
  };

  renderRead();
  return layer;
}
