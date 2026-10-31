import { API_BASE } from './environment.js';
import { openNotice } from '../ui/user-ui.js';

function identifierFrom(target) {
  const form = target?.closest?.('form');
  if (!form) return '';
  return String(new FormData(form).get('identifier') || '').trim();
}

function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

async function requestPasswordReset(target) {
  const identifier = identifierFrom(target);
  if (!validPhone(identifier)) {
    target.closest?.('form')?.querySelector?.('[name="identifier"]')?.focus?.();
    openNotice({
      title: 'Восстановление пароля',
      message: 'Укажите номер телефона.',
      action: 'Закрыть',
    });
    return;
  }

  target.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/online-booking/account/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    if (!response.ok) throw new Error('request failed');
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

document.addEventListener('click', (event) => {
  const element = event.target instanceof Element ? event.target : null;
  const target = element?.closest?.('[data-global-account-forgot]');
  if (!target) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void requestPasswordReset(target);
}, true);
