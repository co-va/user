import {
  button,
  copyTextToClipboard,
  modal,
  mountModal,
  openNotice,
  textareaField,
  v2ListEntries,
  v2ListEntry,
} from '../../ui/user-ui.js';

function ownMessage(message = {}, viewer = 'account') {
  const direction = String(message?.direction || '').toLowerCase();
  return viewer === 'profile' ? direction === 'outbound' : direction === 'inbound';
}

function actionEntry(action, title, subtitle = '') {
  return v2ListEntry({
    title,
    subtitle,
    data: `data-messenger-message-action="${action}"`,
    aria: title,
  });
}

function closeModal(layer) {
  layer?.v2Close?.();
}

function openReactionPicker({ message, actions, render }) {
  const values = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const content = v2ListEntries(values.map((emoji) => actionEntry(`reaction:${emoji}`, emoji)));
  const layer = mountModal(document.body, modal(content, {
    title: 'Реакция',
    variant: 'x',
    surface: 'app',
    xRole: 'action',
  }));
  layer?.querySelectorAll('[data-messenger-message-action]').forEach((node) => node.addEventListener('click', async () => {
    const action = String(node.dataset.messengerMessageAction || '');
    const emoji = action.startsWith('reaction:') ? action.slice('reaction:'.length) : '';
    if (!emoji) return;
    node.disabled = true;
    try {
      await actions.react(message.id, emoji);
      closeModal(layer);
      await render();
    } catch (error) {
      node.disabled = false;
      openNotice({ title: 'Реакция не сохранена', message: error instanceof Error ? error.message : 'Не удалось изменить реакцию' });
    }
  }));
}

function openEditMessage({ message, actions, render }) {
  const content = `<form data-message-edit-form>${textareaField({
    label: 'Сообщение',
    name: 'body',
    value: String(message?.body || ''),
    rows: 4,
    maxlength: 4000,
    required: true,
  })}${button('Сохранить', { data: 'data-message-edit-save' })}</form>`;
  const layer = mountModal(document.body, modal(content, {
    title: 'Изменить сообщение',
    variant: 'x',
    surface: 'app',
    xRole: 'editor',
  }));
  const form = layer?.querySelector('[data-message-edit-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = String(new FormData(form).get('body') || '').trim();
    if (!body) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await actions.edit(message.id, body);
      closeModal(layer);
      await render();
    } catch (error) {
      if (submit) submit.disabled = false;
      openNotice({ title: 'Сообщение не изменено', message: error instanceof Error ? error.message : 'Не удалось изменить сообщение' });
    }
  });
}

async function openForwardPicker({ message, actions, render, getConversations, threadTitle }) {
  const conversations = await getConversations();
  const values = (Array.isArray(conversations) ? conversations : []).filter((item) => item?.id);
  const content = values.length
    ? v2ListEntries(values.map((conversation, index) => v2ListEntry({
      title: threadTitle(conversation),
      subtitle: String(conversation?.type || '').toUpperCase() === 'GROUP' ? 'Группа' : 'Диалог',
      data: `data-message-forward-target="${index}"`,
      aria: `Переслать в ${threadTitle(conversation)}`,
    })))
    : '<p>Нет доступных диалогов.</p>';
  const layer = mountModal(document.body, modal(content, {
    title: 'Переслать',
    variant: 'x',
    surface: 'app',
    xRole: 'picker',
  }));
  layer?.querySelectorAll('[data-message-forward-target]').forEach((node) => node.addEventListener('click', async () => {
    const target = values[Number(node.dataset.messageForwardTarget)];
    if (!target?.id) return;
    node.disabled = true;
    try {
      await actions.forward(message.id, target.id);
      closeModal(layer);
      await render();
    } catch (error) {
      node.disabled = false;
      openNotice({ title: 'Не удалось переслать', message: error instanceof Error ? error.message : 'Сообщение не переслано' });
    }
  }));
}

export function openMessengerMessageActions({
  message,
  viewer = 'account',
  actions,
  render,
  setReply,
  getConversations,
  threadTitle = () => 'Диалог',
} = {}) {
  if (!message?.id || !actions) return null;
  const own = ownMessage(message, viewer);
  const items = [
    actionEntry('reply', 'Ответить'),
    message.body ? actionEntry('copy', 'Копировать') : '',
    actionEntry('forward', 'Переслать'),
    own && message.body && !message.poll ? actionEntry('edit', 'Изменить') : '',
    actionEntry('reaction', 'Реакция'),
    actionEntry('pin', message.pinnedAt ? 'Открепить' : 'Закрепить'),
    actionEntry('info', 'Информация'),
    own ? actionEntry('delete', 'Удалить') : '',
  ].filter(Boolean);
  const layer = mountModal(document.body, modal(v2ListEntries(items), {
    title: 'Сообщение',
    variant: 'x',
    surface: 'app',
    xRole: 'action',
  }));

  layer?.querySelectorAll('[data-messenger-message-action]').forEach((node) => node.addEventListener('click', async () => {
    const action = String(node.dataset.messengerMessageAction || '');
    if (!action) return;
    closeModal(layer);
    if (action === 'reply') {
      setReply?.(message);
      return;
    }
    if (action === 'copy') {
      await copyTextToClipboard(String(message.body || ''));
      return;
    }
    if (action === 'edit') {
      openEditMessage({ message, actions, render });
      return;
    }
    if (action === 'reaction') {
      openReactionPicker({ message, actions, render });
      return;
    }
    if (action === 'forward') {
      try {
        await openForwardPicker({ message, actions, render, getConversations, threadTitle });
      } catch (error) {
        openNotice({ title: 'Не удалось открыть диалоги', message: error instanceof Error ? error.message : 'Пересылка недоступна' });
      }
      return;
    }
    if (action === 'pin') {
      try {
        await actions.pin(message.id);
        await render();
      } catch (error) {
        openNotice({ title: 'Не удалось закрепить', message: error instanceof Error ? error.message : 'Действие недоступно' });
      }
      return;
    }
    if (action === 'delete') {
      try {
        await actions.remove(message.id);
        await render();
      } catch (error) {
        openNotice({ title: 'Не удалось удалить', message: error instanceof Error ? error.message : 'Сообщение не удалено' });
      }
      return;
    }
    if (action === 'info') {
      const status = message.readAt ? 'Прочитано' : message.deliveredAt ? 'Доставлено' : message.sentAt ? 'Отправлено' : String(message.status || '');
      const created = message.createdAt ? new Date(message.createdAt).toLocaleString('ru-RU') : '';
      openNotice({ title: 'Информация о сообщении', message: [status, created].filter(Boolean).join(' · ') || 'Нет дополнительных данных' });
    }
  }));
  return layer;
}
