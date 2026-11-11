import { escapeHtml } from '../utils/escape-html.js';

function isAddAction(action) {
  if (!action) return false;
  const label = String(action.label || '').trim().toLocaleLowerCase('ru-RU');
  const data = String(action.data || '');
  return action.kind === 'add'
    || label === '+'
    || label.startsWith('добав')
    || /data-(?:[a-z0-9-]*-)?add(?:-|\b)/i.test(data);
}

/**
 * Canonical workspace Header context.
 * A is photo metadata only. V is the independent floating section action.
 * C accepts add actions only; D remains the Messenger entry/action.
 */
export function workspaceHeaderContext({ title = '', a = null, v = null, c = null, d = null } = {}) {
  const cData = c?.data ? ` ${String(c.data).trim()}` : '';
  const dData = d?.data ? ` ${String(d.data).trim()}` : '';
  const vData = v?.data ? ` ${String(v.data).trim()}` : '';
  const cDisabled = c?.disabled ? ' disabled' : '';
  const vDisabled = v?.disabled ? ' disabled' : '';
  const aContext = a ? `<span hidden data-workspace-a-context data-workspace-a-label="${escapeHtml(a.label || '')}" data-workspace-a-image="${escapeHtml(a.image || '')}" data-workspace-a-image-position="${escapeHtml(a.imagePosition || '')}" data-workspace-a-initials="${escapeHtml(a.initials || '')}"></span>` : '';
  const vAction = v ? `<button type="button" class="workspace-header-context__v-action" data-workspace-v-action${vData} aria-label="${escapeHtml(v.aria || v.label || 'Действия раздела')}"${vDisabled}></button>` : '';
  const cAction = isAddAction(c) ? `<button type="button" class="workspace-header-context__c-action" data-v2-primary-action data-v2-primary-label="+" data-workspace-c-kind="add"${cData} aria-label="${escapeHtml(c?.aria || c?.label || 'Добавить')}"${cDisabled}></button>` : '';
  const dAction = d ? `<button type="button" class="workspace-header-context__d-action" data-workspace-d-action${dData} data-workspace-d-kind="${escapeHtml(d.kind || 'chat')}" aria-label="${escapeHtml(d.aria || 'Действие справа')}"></button>` : '';
  return `<div class="workspace-header-context" data-workspace-header-context data-workspace-title="${escapeHtml(title)}">${aContext}${vAction}${cAction}${dAction}</div>`;
}
