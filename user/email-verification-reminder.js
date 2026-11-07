import { getAccountToken } from '../core/account/index.js';
import { getAccountEmailVerification, requestAccountEmailVerification } from '../core/account/email.js';
import { button } from '../ui/buttons/index.js';
import { modal, mountModal } from '../ui/modals/index.js';
import { escapeHtml } from '../ui/utils/escape-html.js';

let checkedAccountId = '';
let checkingAccountId = '';
let reminderEpoch = 0;

window.addEventListener('user:auth-logout', () => {
  reminderEpoch += 1;
  checkedAccountId = '';
  checkingAccountId = '';
  document.querySelector('[data-user-email-verification-reminder]')?.v2Close?.();
});

export async function offerAccountEmailVerificationReminder(root, state) {
  const id = String(state?.account?.id || '').trim();
  const token = getAccountToken();
  if (!id || !token || checkedAccountId === id || checkingAccountId === id) return null;
  checkingAccountId = id;
  const epoch = reminderEpoch;
  const stillCurrent = () => epoch === reminderEpoch
    && getAccountToken() === token
    && root.isConnected
    && root.userRelationshipState === state
    && String(state.account?.id || '') === id;

  try {
    const status = await getAccountEmailVerification();
    if (!stillCurrent()) return null;
    if (status?.verified === true) {
      checkedAccountId = id;
      return null;
    }
    if (document.querySelector('[data-user-email-verification-reminder]')) return null;

    const address = String(status?.email || state.account.email || '').trim();
    const content = `<div class="modal-title">
      <h2>Подтвердите email</h2>
      <p>Подтвердите адрес <strong>${escapeHtml(address || 'вашей учётной записи')}</strong>, чтобы получать сервисные письма и восстанавливать пароль.</p>
      <p>Откройте письмо с подтверждением. Если его нет, проверьте папку «Спам». Если адрес неверный — исправьте его.</p>
    </div>
    <p class="muted" data-user-email-verification-status role="status" aria-live="polite">Проверяем отправку письма…</p>
    <div class="modal-actions">
      ${button('Исправить email', { variant: 'outline', data: 'data-user-email-verification-change' })}
      ${button('Отправить повторно', { variant: 'outline', data: 'data-user-email-verification-resend' })}
      ${button('Понятно', { data: 'data-user-email-verification-later' })}
    </div>`;
    const layer = mountModal(document.body, modal(content, {
      variant: 'technical',
      title: 'Подтверждение email',
      className: 'modal--email-verification-reminder',
    }));
    if (!layer) return null;
    layer.dataset.userEmailVerificationReminder = id;
    checkedAccountId = id;

    const message = layer.querySelector('[data-user-email-verification-status]');
    const resend = layer.querySelector('[data-user-email-verification-resend]');
    const send = async () => {
      if (!stillCurrent() || !layer.isConnected || resend?.disabled) return;
      if (resend) resend.disabled = true;
      if (message) message.textContent = 'Запрашиваем письмо подтверждения…';
      try {
        const result = await requestAccountEmailVerification();
        if (!stillCurrent() || !layer.isConnected) return;
        if (message) message.textContent = result?.alreadyVerified
          ? 'Email уже подтверждён. При следующем входе уведомление не появится.'
          : result?.throttled
            ? 'Повторная отправка временно ограничена. Проверьте «Входящие» и «Спам».'
            : result?.sent
              ? 'Письмо принято почтовым сервером. Проверьте «Входящие» и «Спам».'
              : 'Отправка не подтверждена сервером. Попробуйте позднее.';
      } catch {
        if (stillCurrent() && layer.isConnected && message) message.textContent = 'Письмо не отправлено. Повторите попытку позднее.';
      } finally {
        if (resend?.isConnected) resend.disabled = false;
      }
    };
    layer.querySelector('[data-user-email-verification-change]')?.addEventListener('click', () => {
      layer.v2Close?.();
      if (!stillCurrent()) return;
      void import('./personal-data.js')
        .then(({ openAccountPersonalDataZ }) => {
          if (stillCurrent()) openAccountPersonalDataZ(root, state);
        })
        .catch(() => undefined);
    });
    layer.querySelector('[data-user-email-verification-later]')?.addEventListener('click', () => layer.v2Close?.());
    resend?.addEventListener('click', () => void send());
    // Core owns delivery and the 10-minute cooldown.
    void send();
    return layer;
  } catch {
    // Verification failures never block User login.
    return null;
  } finally {
    if (checkingAccountId === id && epoch === reminderEpoch) checkingAccountId = '';
  }
}
