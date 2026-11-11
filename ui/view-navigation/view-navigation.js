import { escapeHtml } from '../utils/escape-html.js';

export function viewNavigation({ views = [], activeView = '', ariaLabel = 'Представление' } = {}) {
  return `<div class="segment-control" role="tablist" aria-label="${escapeHtml(ariaLabel)}" data-view-navigation>${views.map(({ id, label, notification = false }) => `<button type="button" role="tab" aria-selected="${id === activeView}" aria-label="${escapeHtml(label)}${notification ? ', есть изменения' : ''}" class="${id === activeView ? 'is-active' : ''}${notification ? ' has-notification' : ''}" data-view="${escapeHtml(id)}">${escapeHtml(label)}</button>`).join('')}</div>`;
}

export function initViewNavigation(root, { views, activeView, onChange }) {
  const navigation = root.querySelector('[data-view-navigation]');
  if (!navigation) return;
  let currentView = activeView;

  navigation.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextView = button.dataset.view;
      if (!views.some(({ id }) => id === nextView) || nextView === currentView) return;
      currentView = nextView;
      navigation.querySelectorAll('[data-view]').forEach((item) => {
        const isActive = item.dataset.view === currentView;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-selected', String(isActive));
      });
      onChange(nextView);
    });
  });
}

export function setViewNotification(root, viewId, visible) {
  const navigation = root?.querySelector?.('[data-view-navigation]');
  const tab = [...(navigation?.querySelectorAll('[data-view]') || [])].find((node) => node.dataset.view === viewId);
  if (!tab) return;
  tab.classList.toggle('has-notification', Boolean(visible));
  tab.setAttribute('aria-label', tab.textContent.trim() + (visible ? ', есть изменения' : ''));
}
