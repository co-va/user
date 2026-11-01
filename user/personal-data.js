import { accountErrorMessage, updateGlobalAccount } from '../core/account/index.js';
import { changeAccountEmail, getAccountEmailVerification } from '../core/account/email.js';
import {
  formValidationMessage,
  openNotice,
  openSharedPersonalDataEditor,
  readSharedPersonalDataEditor,
} from '../ui/user-ui.js';

function profileData(account = {}) {
  return account.profileData && typeof account.profileData === 'object' ? account.profileData : {};
}

function formSignature(form) {
  return JSON.stringify([...new FormData(form).entries()].map(([key, value]) => [key, String(value)]));
}

async function syncEmailStatus(layer) {
  const status = layer?.querySelector('[data-account-email-status]');
  if (!status) return;
  try {
    const state = await getAccountEmailVerification();
    status.textContent = state?.verified ? 'Email подтверждён.' : 'Email не подтверждён.';
  } catch {
    status.textContent = 'Статус email сейчас недоступен.';
  }
}

export function openAccountPersonalDataZ(root, state, { onSaved, onDirtyChange, onClosed } = {}) {
  const layer = openSharedPersonalDataEditor({
    account: state.account || {},
    onClose: () => {
      onDirtyChange?.(false);
      onClosed?.();
    },
  });
  if (!layer) return null;

  void syncEmailStatus(layer);

  const form = layer.querySelector('[data-account-personal-form]');
  const errorNode = layer.querySelector('[data-account-personal-error]');
  const saveButton = layer.querySelector('[data-account-personal-save]');
  const saveActions = saveButton?.closest('.modal-actions');
  const initialSignature = form ? formSignature(form) : '';
  const syncDirty = () => {
    const dirty = Boolean(form && formSignature(form) !== initialSignature);
    if (saveActions) saveActions.hidden = !dirty;
    onDirtyChange?.(dirty);
  };
  form?.addEventListener('input', syncDirty);
  form?.addEventListener('change', syncDirty);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validationError = formValidationMessage(form);
    if (validationError) {
      if (errorNode) errorNode.textContent = validationError;
      return;
    }

    if (errorNode) errorNode.textContent = '';
    if (saveButton) saveButton.disabled = true;
    try {
      const values = readSharedPersonalDataEditor(form);
      const currentProfile = profileData(state.account || {});
      const requestedEmail = values.email;
      const currentEmail = String(state.account?.email || '').trim().toLowerCase();
      const payload = {
        name: values.name,
        surname: values.surname,
        phone: values.phone,
        profileData: {
          ...currentProfile,
          phones: values.phones,
          emails: values.emails,
          telegram: values.telegram,
          telegrams: values.telegrams,
          gender: values.gender,
          birthDate: values.birthDate,
          links: values.links,
        },
      };
      const account = await updateGlobalAccount(payload);
      state.account = account;

      if (requestedEmail && requestedEmail !== currentEmail) {
        await changeAccountEmail(requestedEmail);
        openNotice({
          title: 'Подтвердите новый email',
          message: `Письмо отправлено на ${requestedEmail}. Email изменится после подтверждения по ссылке.`,
          action: 'Закрыть',
        });
      }

      onDirtyChange?.(false);
      layer.v2Close?.();
      await onSaved?.(account);
    } catch (error) {
      if (saveButton) saveButton.disabled = false;
      openNotice({
        title: 'Данные не сохранены',
        message: accountErrorMessage(error, error instanceof Error ? error.message : 'Не удалось сохранить данные'),
        action: 'Закрыть',
        variant: 'technical',
      });
    }
  });

  if (saveActions) saveActions.hidden = true;
  return layer;
}
