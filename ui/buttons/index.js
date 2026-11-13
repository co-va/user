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


// Compact is a separate control family, never a reduced full-size .ui-button.
// All glyph actions (+, i, copy, ×) go through this one semantic button shell.
export function compactControl({ kind = 'add', className = '', data = '', aria = '', content = '' } = {}) {
  const variant = ['add', 'info', 'remove'].includes(kind) ? kind : 'add';
  const classes = ['ui-compact-control', `ui-compact-control--${variant}`, className].filter(Boolean).join(' ');
  return `<button type="button" class="${escapeHtml(classes)}"${data ? ` ${data}` : ''} aria-label="${escapeHtml(aria || (variant === 'remove' ? 'Удалить' : 'Добавить'))}">${content}</button>`;
}

export function compactAddControl({ className = '', data = '', aria = 'Добавить' } = {}) {
  return compactControl({ kind: 'add', className: `ui-add-control${className ? ` ${className}` : ''}`, data, aria, content: '+' });
}

export function compactRemoveControl({ className = '', data = '', aria = 'Удалить' } = {}) {
  return compactControl({ kind: 'remove', className: `remove-button${className ? ` ${className}` : ''}`, data, aria, content: '×' });
}

export function iconButton(label, { className = '', data = '', aria = label } = {}) {
  return `<button type="button" class="icon-button ${className}" ${data} aria-label="${escapeHtml(aria)}">${label}</button>`;
}

export function smallActionButton({ icon = 'info', className = '', data = '', aria = '' } = {}) {
  const kind = icon === 'copy' ? 'copy' : 'info';
  const content = kind === 'copy'
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1"></path></svg><span class="small-action-button__done" aria-hidden="true">✓</span>'
    : '<span class="small-action-button__info" aria-hidden="true">i</span>';
  return compactControl({
    kind: 'info',
    className: `small-action-button small-action-button--${kind}${kind === 'copy' ? ' copy-icon-button' : ''}${className ? ` ${className}` : ''}`,
    data,
    aria: aria || (kind === 'copy' ? 'Скопировать' : 'Информация'),
    content,
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
