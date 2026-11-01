import { datePicker, initDatePickers } from '../ui/calendar/index.js';
import { field, textareaField } from '../ui/inputs/index.js';
import { colorPicker, initColorPickers } from '../ui/colors/index.js';
import { select } from '../ui/selectors/index.js';
import { NOTE_DEFAULT_COLOR } from '../ui/note/index.js';
import {
  noteContextWithTarget,
  noteTargetOptions,
  noteTargetValue,
  parseNoteTargetValue,
} from './note-target.js';

export function userNoteEditorMarkup(note = {}, {
  targetSource = null,
  includeNote = null,
  formData = 'data-user-note-editor',
} = {}) {
  return `<form class="form-grid" ${formData}>
    <div class="user-note-color-picker">${colorPicker({ name: 'color', value: note.color || NOTE_DEFAULT_COLOR })}</div>
    ${datePicker({ label: 'Дата', name: 'date', value: note.date || '', required: true, allowClear: false })}
    ${select({
      label: 'Прикрепить к',
      name: 'target',
      value: noteTargetValue(note),
      options: noteTargetOptions(note.date, { includeNote, source: targetSource }),
      aria: 'Прикрепить заметку',
    })}
    ${field({ label: 'Наименование', name: 'title', value: note.title || '' })}
    ${textareaField({ label: 'Текст', name: 'text', value: note.text || '', rows: 8, placeholder: 'Текст заметки' })}
  </form>`;
}

export function initUserNoteEditor(root) {
  initDatePickers(root);
  initColorPickers(root);
}

export function readUserNoteEditor(form, {
  currentContext = { scope: 'account' },
  targetSource = null,
  fallbackDate = '',
} = {}) {
  const data = form ? new FormData(form) : new FormData();
  const target = parseNoteTargetValue(data.get('target'));
  return {
    context: noteContextWithTarget(currentContext, target.targetType, target.targetId, { source: targetSource }),
    date: String(data.get('date') || fallbackDate || '').slice(0, 10),
    targetType: target.targetType,
    targetId: target.targetId,
    title: String(data.get('title') || '').trim(),
    text: String(data.get('text') || '').trim(),
    color: String(data.get('color') || NOTE_DEFAULT_COLOR),
  };
}
