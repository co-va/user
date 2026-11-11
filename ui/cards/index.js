import { escapeHtml } from '../utils/escape-html.js';

export function entityCardStack(cards = [], { className = '' } = {}) {
  const items = Array.isArray(cards) ? cards : [];
  return `<div class="entity-card-stack${className ? ` ${escapeHtml(className)}` : ''}" data-entity-card-stack style="box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;width:100%;min-width:0;padding-top:12px;align-content:start">${items.join('')}</div>`;
}

export function entityCardRail(cards = [], { className = '' } = {}) {
  const items = Array.isArray(cards) ? cards : [];
  return `<div class="entity-card-rail${className ? ` ${escapeHtml(className)}` : ''}" data-entity-card-rail data-v2-horizontal-rail>${items.join('')}</div>`;
}
