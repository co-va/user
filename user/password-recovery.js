import {
  confirmAccountPasswordReset,
  requestAccountPasswordReset,
} from '../core/account/password-reset.js';
import {
  formValidationMessage,
  initPasswordFields,
  passwordField,
} from '../ui/inputs/index.js';
import { button } from '../ui/buttons/index.js';
import { openNotice } from '../ui/modals/index.js';
import { v2Sticker } from '../ui/v2/sticker.js';
import { formError, formView } from '../ui/forms/index.js';

let requestHandlerInstalled = false;

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function validIdentifier(value) {
  return validEmail(value) || validPhone(value);
}

function goToLogin() {
  window.location.assign('/');
}

async function requestFromLogin(target) {
  const form = target?.closest?.('form');
  const identifier = form ? String(new FormData(form).get('identifier') || '').trim() : '';
  if (!validIdentifier(identifier)) {
    form?.querySelector?.('[name="identifier"]')?.focus?.();
    openNotice({
      title: 'Восстановление пароля',
      message: 'Укажите телефон или email.',
      action: 'Закрыть',
    });
    return;
  }

  target.disabled = true;
  try {
    await requestAccountPasswordReset(identifier);
    openNotice({
      title: 'Восстановление пароля',
      message: 'Если аккаунт найден и его email подтверждён, ссылка для смены пароля отправлена. Она действует 30 минут.',
      action: 'Закрыть',
    });
  } catch {
    openNotice({
      title: 'Восстановление пароля',
      message: 'Сервис восстановления сейчас недоступен. Повторите попытку позже.',
      action: 'Закрыть',
      variant: 'technical',
    });
  } finally {
    target.disabled = false;
  }
}

export function installPasswordRecoveryRequest() {
  if (requestHandlerInstalled) return;
  requestHandlerInstalled = true;
  document.addEventListener('click', (event) => {
    const element = event.target instanceof Element ? event.target : null;
    const target = element?.closest?.('[data-global-account-forgot]');
    if (!target) return;
    event.preventDefault();
    void requestFromLogin(target);
  });
}

export function isPasswordResetLocation() {
  return window.location.pathname === '/reset-password.html';
}

function renderInvalidReset(root, message) {
  root.innerHTML = `<section class="user-account">${v2Sticker({
    title: 'Восстановление пароля',
    body: formError(message || 'Ссылка восстановления недействительна или истекла.'),
    action: button('Войти', { data: 'data-password-reset-login' }),
    className: 'v2-sticker-screen--auth',
    closeData: 'data-password-reset-close',
  })}</section>`;
  root.querySelector('[data-password-reset-login]')?.addEventListener('click', goToLogin);
  root.querySelector('[data-password-reset-close]')?.addEventListener('click', goToLogin);
}

function renderResetSuccess(root) {
  root.innerHTML = `<section class="user-account">${v2Sticker({
    title: 'Пароль изменён',
    body: '<p>Новый пароль сохранён. Теперь можно войти.</p>',
    action: button('Войти', { data: 'data-password-reset-login' }),
    className: 'v2-sticker-screen--auth',
    closeData: 'data-password-reset-close',
  })}</section>`;
  root.querySelector('[data-password-reset-login]')?.addEventListener('click', goToLogin);
  root.querySelector('[data-password-reset-close]')?.addEventListener('click', goToLogin);
}

export function renderPasswordReset(root) {
  const params = new URLSearchParams(window.location.search);
  const kind = String(params.get('kind') || '').trim().toLowerCase();
  const token = String(params.get('token') || '').trim();
  if (kind !== 'account' || token.length < 32) {
    renderInvalidReset(root, 'Ссылка восстановления недействительна или истекла.');
    return;
  }

  let error = '';
  const render = () => {
    const form = formView(`
      ${passwordField({ label: 'Новый пароль', name: 'newPassword', required: true, autocomplete: 'new-password' })}
      ${passwordField({ label: 'Повтор пароля', name: 'repeatPassword', required: true, autocomplete: 'new-password' })}
      ${formError(error)}
    `, { data: 'id="user-password-reset" data-user-password-reset' });

    root.innerHTML = `<section class="user-account">${v2Sticker({
      title: 'Новый пароль',
      body: form,
      action: button('Сохранить', { type: 'submit', data: 'form="user-password-reset"' }),
      className: 'v2-sticker-screen--auth',
      closeData: 'data-password-reset-close',
    })}</section>`;

    initPasswordFields(root);
    root.querySelector('[data-password-reset-close]')?.addEventListener('click', goToLogin);
    const resetForm = root.querySelector('[data-user-password-reset]');
    resetForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const validationError = formValidationMessage(resetForm);
      if (validationError) {
        error = validationError;
        render();
        return;
      }

      const data = new FormData(resetForm);
      const newPassword = String(data.get('newPassword') || '');
      const repeatPassword = String(data.get('repeatPassword') || '');
      if (newPassword.length < 8) {
        error = 'Новый пароль должен содержать минимум 8 символов.';
        render();
        return;
      }
      if (newPassword !== repeatPassword) {
        error = 'Пароли не совпадают.';
        render();
        return;
      }

      const submit = root.querySelector('button[type="submit"][form="user-password-reset"]');
      if (submit) submit.disabled = true;
      try {
        await confirmAccountPasswordReset(token, newPassword);
        window.history.replaceState({}, '', '/');
        renderResetSuccess(root);
      } catch (requestError) {
        error = requestError instanceof Error
          ? requestError.message
          : 'Ссылка восстановления недействительна или истекла.';
        render();
      }
    });
  };

  render();
}
