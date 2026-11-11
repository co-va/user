import { escapeHtml } from '../utils/escape-html.js';
export function emptyState(title, text = '') {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${text ? `<span>${escapeHtml(text)}</span>` : ''}</div>`;
}
