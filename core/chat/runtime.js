// Chat is intentionally excluded from the User extraction stage.
// This adapter keeps the surrounding User shell stable without carrying the legacy chat runtime.

function unavailable(surface, title = 'Чат') {
  if (typeof surface !== 'function') return;
  surface({
    mode: 'list',
    title,
    body: '<div class="state-view"><h2>Чат</h2><p>Чат будет подключён отдельным этапом.</p></div>',
  });
}

export function mountChatChannelHeader() {
  return () => '';
}

export function normalizeChatMessages() {
  return [];
}

export function mountChatList(_root, { title = 'Чат', surface } = {}) {
  unavailable(surface, title);
}

export function mountChatThread(_root, { title = 'Чат', surface } = {}) {
  unavailable(surface, title);
}
