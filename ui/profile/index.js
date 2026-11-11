import { datePicker, initDatePickers } from '../calendar/index.js';
import { button } from '../buttons/index.js';
import { formError, formView } from '../forms/index.js';
import { field, formValidationMessage, initPasswordFields, passwordField, phoneInput, selectPhotoFile } from '../inputs/index.js';
import { collectLinks, initLinks, links } from '../links/index.js';
import { modal, mountModal, openNotice } from '../modals/index.js';
import { actionBlock } from '../page/page.js';
import { collectRepeatedField, initRepeatedFields, repeatedField } from '../repeated-fields/index.js';
import { select } from '../selectors/index.js';
import { settingsPanel } from '../settings/index.js';
import { v2ListEntry, v2ListEntries } from '../lists/list-entry.js';
import { escapeHtml } from '../utils/escape-html.js';

function actionData(id = '') {
  return `data-shared-profile-action="${String(id || '').trim()}"`;
}

function profileData(account = {}) {
  return account.profileData && typeof account.profileData === 'object' ? account.profileData : {};
}

function unique(values = [], limit = 5) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))].slice(0, limit);
}

function bareInput({ name = '', value = '', type = 'text', placeholder = '', required = false, autocomplete = '', maxlength = '' } = {}) {
  return `<input class="profile-editor__primary-input" name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${required ? ' required' : ''}${autocomplete ? ` autocomplete="${escapeHtml(autocomplete)}"` : ''}${maxlength !== '' ? ` maxlength="${escapeHtml(maxlength)}"` : ''}>`;
}

function profileEditorSection(title = '', content = '') {
  return `<section class="profile-editor__section"><h2 class="profile-editor__section-title">${escapeHtml(title)}</h2><div class="profile-editor__section-body">${content}</div></section>`;
}

export function openSharedPersonalDataEditor({ account = {}, onClose = null } = {}) {
  const profile = profileData(account);
  const today = new Date();
  const currentYear = today.getFullYear();
  const maxBirthDate = `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const personalFields = `<div class="form-grid profile-editor__personal-grid">
    ${field({ label: 'Имя', name: 'name', value: account.name || '', required: true, autocomplete: 'given-name' })}
    ${field({ label: 'Фамилия', name: 'surname', value: account.surname || '', autocomplete: 'family-name' })}
    ${select({
      label: 'Пол',
      name: 'gender',
      value: profile.gender || '',
      options: [
        { value: '', label: 'Не указан' },
        { value: 'male', label: 'Мужской' },
        { value: 'female', label: 'Женский' },
      ],
    })}
    ${datePicker({
      label:'Дата рождения',
      name:'birthDate',
      value:profile.birthDate || '',
      max:maxBirthDate,
      minYear:currentYear - 110,
      maxYear:currentYear,
      initialYear:currentYear - 30,
      allowClear:true,
    })}
  </div>`;

  const contactFields = `<div class="profile-editor__contacts-grid">
    ${repeatedField({
      label:'Телефон *',
      name:'additionalPhone',
      values:profile.phones || [],
      type:'tel',
      placeholder:'Дополнительный телефон',
      showEmptyRow:false,
      addInHeader:true,
      lead:phoneInput({ name:'phone', value:account.phone || '', required:true, aria:'Телефон' }),
    })}
    ${repeatedField({
      label:'Email *',
      name:'additionalEmail',
      values:profile.emails || [],
      type:'email',
      placeholder:'name@example.com',
      showEmptyRow:false,
      addInHeader:true,
      lead:bareInput({ name:'email', value:account.email || '', type:'email', required:true, autocomplete:'email' }),
    })}
    <div class="profile-editor__verification-row">
      <span data-account-email-status>Проверяем подтверждение email…</span>
    </div>
    ${repeatedField({
      label:'Telegram',
      name:'additionalTelegram',
      values:profile.telegrams || [],
      type:'text',
      placeholder:'@username',
      showEmptyRow:false,
      addInHeader:true,
      lead:bareInput({ name:'telegram', value:profile.telegram || '', placeholder:'@username', maxlength:100 }),
    })}
    ${links({ label:'Ссылки', links:Array.isArray(profile.links) ? profile.links : [], name:'accountProfileLinks', addInHeader:true })}
  </div>`;

  const content = formView(`
    <div class="profile-editor">
      ${profileEditorSection('Личные данные', personalFields)}
      ${profileEditorSection('Контактные данные', contactFields)}
    </div>
    ${formError('', { data: 'data-account-personal-error', keepEmpty: true })}
    ${actionBlock(button('Сохранить', { type: 'submit', data: 'data-account-personal-save' }))}
  `, { className: 'account-personal-data-form profile-editor-form', data: 'data-account-personal-form' });

  const layer = mountModal(document.body, modal(content, {
    variant: 'q',
    className: 'modal--profile-editor',
  }));
  if (!layer) return null;

  initRepeatedFields(layer);
  initLinks(layer);
  initDatePickers(layer);

  if (typeof onClose === 'function') {
    const close = layer.v2Close?.bind(layer);
    let closed = false;
    layer.v2Close = () => {
      if (closed) return;
      closed = true;
      onClose();
      close?.();
    };
  }
  return layer;
}

export function readSharedPersonalDataEditor(form) {
  const data = new FormData(form);
  return {
    name: String(data.get('name') || '').trim(),
    surname: String(data.get('surname') || '').trim(),
    phone: String(data.get('phone') || '').trim(),
    email: String(data.get('email') || '').trim().toLowerCase(),
    phones: unique(collectRepeatedField(form, 'additionalPhone')),
    emails: unique(collectRepeatedField(form, 'additionalEmail').map((value) => String(value).toLowerCase())),
    telegram: String(data.get('telegram') || '').trim(),
    telegrams: unique(collectRepeatedField(form, 'additionalTelegram')),
    gender: String(data.get('gender') || ''),
    birthDate: String(data.get('birthDate') || ''),
    links: collectLinks(form, 'accountProfileLinks').slice(0, 8),
  };
}

export function openSharedProfileSettingsMenu({
  title = 'Настройки профиля',
  controls = [],
  actions = [],
  data = 'data-shared-profile-settings-menu',
} = {}) {
  const controlItems = (Array.isArray(controls) ? controls : []).filter((item) => item?.id && item?.label);
  const items = (Array.isArray(actions) ? actions : []).filter((item) => item?.id && item?.label);
  const controlsMarkup = controlItems.length
    ? v2ListEntries(controlItems.map((item) => v2ListEntry({
        title: item.label,
        subtitle: item.description || '',
        interactive: false,
        initial: '',
        toggleData: `data-shared-profile-toggle="${String(item.id)}"`,
        toggleAria: item.aria || item.label,
        toggleChecked: Boolean(item.checked),
        toggleDisabled: Boolean(item.disabled),
      })))
    : '';
  const body = `<div ${data}>${controlsMarkup}${settingsPanel(items.map((item) => ({
    label: item.label,
    variant: item.variant || 'outline',
    data: actionData(item.id),
    disabled: Boolean(item.disabled),
  })))}</div>`;
  const layer = mountModal(document.body, modal(body, {
    variant: 'x',
    title,
    className: 'modal--profile-settings-sheet',
    xRole: 'action',
  }));
  if (!layer) return null;

  controlItems.forEach((item) => {
    const control = layer.querySelector(`[data-shared-profile-toggle="${CSS.escape(String(item.id))}"]`);
    control?.addEventListener('click', async () => {
      const current = control.getAttribute('aria-pressed') === 'true';
      control.disabled = true;
      try {
        const result = await item.onToggle?.(!current);
        const checked = typeof result === 'boolean' ? result : !current;
        control.setAttribute('aria-pressed', checked ? 'true' : 'false');
        control.classList.toggle('is-on', checked);
        control.querySelector('.app-setting-toggle__switch')?.classList.toggle('is-on', checked);
      } catch (error) {
        void item.onError?.(error);
      } finally {
        control.disabled = Boolean(item.disabled);
      }
    });
  });

  items.forEach((item) => {
    if (item.disabled) return;
    layer.querySelector(`[data-shared-profile-action="${CSS.escape(String(item.id))}"]`)?.addEventListener('click', () => {
      layer.v2Close?.();
      void item.onSelect?.();
    });
  });
  return layer;
}

export async function openSharedPhotoAction({
  photo = '',
  title = 'Фото',
  onReplace = async () => {},
  onDelete = async () => {},
  onError = () => {},
} = {}) {
  const choose = async () => {
    try {
      const src = await selectPhotoFile();
      if (!src) return false;
      await onReplace(src);
      return true;
    } catch (error) {
      onError(error);
      return false;
    }
  };

  if (!String(photo || '').trim()) return choose();

  const body = `<div class="form-grid">
    ${button('Заменить фото', { variant: 'outline', data: 'data-shared-photo-replace' })}
    ${button('Удалить фото', { variant: 'danger', data: 'data-shared-photo-delete' })}
  </div>`;
  const layer = mountModal(document.body, modal(body, {
    variant: 'x',
    title,
    className: 'modal--photo-sheet',
    xRole: 'action',
  }));
  if (!layer) return null;

  layer.querySelector('[data-shared-photo-replace]')?.addEventListener('click', () => {
    layer.v2Close?.();
    void choose();
  });
  layer.querySelector('[data-shared-photo-delete]')?.addEventListener('click', async () => {
    try {
      await onDelete();
      layer.v2Close?.();
    } catch (error) {
      onError(error);
    }
  });
  return layer;
}

export function openSharedPasswordAction({
  title = 'Изменить пароль',
  onSubmit = async () => {},
  successTitle = 'Пароль изменён',
  successMessage = 'Новый пароль сохранён.',
  errorTitle = 'Пароль не изменён',
  errorMessage = 'Не удалось изменить пароль',
} = {}) {
  const content = formView(`
    ${passwordField({ label: 'Текущий пароль', name: 'currentPassword', required: true, autocomplete: 'current-password' })}
    ${passwordField({ label: 'Новый пароль', name: 'newPassword', required: true, autocomplete: 'new-password' })}
    ${passwordField({ label: 'Повторите новый пароль', name: 'repeatPassword', required: true, autocomplete: 'new-password' })}
    ${formError('', { data: 'data-shared-password-error', keepEmpty: true })}
    ${button('Сохранить пароль', { type: 'submit' })}
  `, { className: 'form-grid', data: 'data-shared-password-form' });
  const layer = mountModal(document.body, modal(content, {
    variant: 'x',
    title,
    className: 'modal--password-sheet',
    xRole: 'editor',
  }));
  if (!layer) return null;

  initPasswordFields(layer);
  const form = layer.querySelector('[data-shared-password-form]');
  const errorNode = layer.querySelector('[data-shared-password-error]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validationError = formValidationMessage(form);
    if (validationError) {
      if (errorNode) errorNode.textContent = validationError;
      return;
    }

    const data = new FormData(form);
    const currentPassword = String(data.get('currentPassword') || '');
    const newPassword = String(data.get('newPassword') || '');
    const repeatPassword = String(data.get('repeatPassword') || '');
    if (newPassword.length < 8) {
      if (errorNode) errorNode.textContent = 'Новый пароль должен содержать минимум 8 символов.';
      return;
    }
    if (newPassword !== repeatPassword) {
      if (errorNode) errorNode.textContent = 'Новые пароли не совпадают.';
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    if (errorNode) errorNode.textContent = '';
    try {
      await onSubmit({ currentPassword, newPassword });
      layer.v2Close?.();
      openNotice({ title: successTitle, message: successMessage, action: 'Закрыть', variant: 'technical' });
    } catch (error) {
      if (submit) submit.disabled = false;
      if (errorNode) errorNode.textContent = error instanceof Error ? error.message : errorMessage;
      openNotice({ title: errorTitle, message: error instanceof Error ? error.message : errorMessage, action: 'Закрыть', variant: 'technical' });
    }
  });
  return layer;
}

export function setSharedProfilePrimary(source, { visible = false, label = 'Сохранить', disabled = false } = {}) {
  if (!source) return;
  source.dataset.v2PrimaryVisible = visible ? 'true' : 'false';
  source.dataset.v2PrimaryLabel = String(label || 'Сохранить');
  source.setAttribute('aria-label', String(label || 'Сохранить'));
  source.disabled = Boolean(disabled);
  window.dispatchEvent(new CustomEvent('user:v2-context-changed'));
}
