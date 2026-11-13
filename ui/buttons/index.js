import { escapeHtml } from '../utils/escape-html.js';

const BUTTON_VARIANTS = {
  secondary: 'ui-button--secondary',
  danger: 'ui-button--danger',
  critical: 'ui-button--critical',
  outline: 'ui-button--outline',
};

export function button(label, { className = '', data = '', type = 'button', aria = '', variant = '', disabled = false } = {}) {
  if (/^назад$/i.test(String(label || '').trim())) return '';
  const variantClass = BUTTON_VARIANTS[variant] || '';
  return `<button type="${type}" class="ui-button ${variantClass} ${className}" ${data}${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}${disabled ? ' disabled' : ''}>${label}</button>`;
}


// A single Compact control: one 28×28 invisible surface, icon varies by intent.
// Compatibility helpers below never render their own markup or geometry.
const COMPACT_ICONS = Object.freeze({
  add: '+',
  remove: '<span class="ui-compact-control__remove" aria-hidden="true">×</span>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 10.5v6"></path><circle cx="12" cy="7.2" r=".8" fill="currentColor" stroke="none"></circle></svg>',
  copy: '<svg data-compact-copy-icon viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1"></path></svg><span class="ui-compact-control__done" data-compact-copy-done aria-hidden="true">✓</span>',
  repeat: '<span class="ui-compact-control__glyph ui-compact-control__glyph--repeat" aria-hidden="true">↻</span>',
  previous: '<span class="ui-compact-control__glyph ui-compact-control__glyph--arrow" aria-hidden="true">←</span>',
  next: '<span class="ui-compact-control__glyph ui-compact-control__glyph--arrow" aria-hidden="true">→</span>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 2.5h3l.6 2.2 2.1.9 2-.9 2.1 2.1-.9 2 .9 2.1 2.2.6v3l-2.2.6-.9 2.1.9 2-2.1 2.1-2-.9-2.1.9-.6 2.2h-3l-.6-2.2-2.1-.9-2 .9-2.1-2.1.9-2-.9-2.1-2.2-.6v-3l2.2-.6.9-2 2.1-2.1 2 .9 2.1-.9Z"/><circle cx="12" cy="12" r="3"/></svg>',
});

const COMPACT_LABELS = Object.freeze({
  add: 'Добавить',
  remove: 'Удалить',
  info: 'Информация',
  copy: 'Скопировать',
  repeat: 'Повторить',
  previous: 'Назад',
  next: 'Вперёд',
  settings: 'Настройки',
});

export function compactControl({ icon = 'add', symbol = '', appearance = 'plain', className = '', data = '', aria = '' } = {}) {
  const key = Object.hasOwn(COMPACT_ICONS, icon) ? icon : 'add';
  const skin = ['dark', 'secondary', 'outlined'].includes(appearance) ? appearance : 'plain';
  const classes = ['ui-compact-control', className].filter(Boolean).join(' ');
  const glyph = symbol
    ? `<span class="ui-compact-control__glyph" aria-hidden="true">${escapeHtml(symbol)}</span>`
    : COMPACT_ICONS[key];
  return `<button type="button" class="${escapeHtml(classes)}"${skin === 'plain' ? '' : ` data-compact-appearance="${skin}"`}${data ? ` ${data}` : ''} aria-label="${escapeHtml(aria || COMPACT_LABELS[key])}">${glyph}</button>`;
}

// Existing call sites may use these names; all resolve to the same compactControl.
export function compactAddControl({ className = '', data = '', aria = 'Добавить' } = {}) {
  return compactControl({ icon: 'add', className, data, aria });
}

export function compactRemoveControl({ className = '', data = '', aria = 'Удалить' } = {}) {
  return compactControl({ icon: 'remove', className, data, aria });
}

export function iconButton(label, { className = '', data = '', aria = label } = {}) {
  return `<button type="button" class="icon-button ${className}" ${data} aria-label="${escapeHtml(aria)}">${label}</button>`;
}

export function smallActionButton({ icon = 'info', className = '', data = '', aria = '' } = {}) {
  const resolved = icon === 'copy' ? 'copy' : 'info';
  return compactControl({
    icon: resolved,
    className: `small-action-button${resolved === 'copy' ? ' copy-icon-button' : ''}${className ? ` ${className}` : ''}`,
    data,
    aria: aria || COMPACT_LABELS[resolved],
  });
}

export function copyIconButton({ data = '', aria = 'Скопировать' } = {}) {
  return smallActionButton({ icon: 'copy', data, aria });
}

export function setCopyButtonCopied(button, { timeout = 1400 } = {}) {
  if (!(button instanceof HTMLElement)) return;
  const previousAria = button.getAttribute('aria-label') || 'Скопировать';
  button.classList.add('is-copied');
  button.setAttribute('aria-label', 'Скопировано');
  window.setTimeout(() => {
    button.classList.remove('is-copied');
    button.setAttribute('aria-label', previousAria);
  }, Math.max(300, Number(timeout) || 1400));
}

export async function copyTextToClipboard(value) {
  const text = String(value ?? '');
  if (!text) return false;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

export function sheetIconButton({ data = '', aria = 'Открыть список' } = {}) {
  return iconButton('▤', { className: 'sheet-icon-button', data, aria });
}

export function iconButtonGroup(items = []) {
  return `<div class="icon-button-group">${items.join('')}</div>`;
}
