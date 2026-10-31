import {
  acceptGlobalAccountTerms,
  accountErrorMessage,
  isAccountSystemError,
  clearAccount,
  getAccountTerms,
  getGlobalAccount,
  getGlobalAccountPlatformState,
  getGlobalAccountRecords,
  getGlobalAccountRelationships,
  getRememberedAccountEmail,
  loginGlobalAccount,
  prepareGlobalAccount,
  registerGlobalAccount,
} from '../core/account/index.js';
import { getGlobalAccountBookingTargets } from '../core/account/booking-targets.js';
import {
  button,
  documentTile,
  documentTiles,
  field,
  formValidationMessage,
  initPasswordFields,
  openDocumentViewer,
  openNotice,
  passwordField,
  phoneField,
  v2Sticker,
} from '../ui/user-ui.js';
import { formError, formView } from '../ui/forms/index.js';
import { renderGlobalAccount } from './account-shell.js';

function flowThemeClasses() {
  return 'booking-account booking-account--account booking-account--v2';
}

function renderLoading(root) {
  root.innerHTML = '<div class="app-bootstrap" role="status">Загрузка…</div>';
}

function accountFlowError(error, fallbackMessage) {
  const message = accountErrorMessage(error, fallbackMessage);
  if (!isAccountSystemError(error)) return message;
  openNotice({
    title: 'Не удалось выполнить действие',
    message,
    action: 'Закрыть',
    variant: 'technical',
  });
  return '';
}

function openConsentDocument(document = {}) {
  return openDocumentViewer({
    title: document?.title || 'Документ',
    version: document?.version || 1,
    content: document?.content ?? document?.text ?? '',
  });
}

function globalAccountState(initial = {}) {
  const journalDate = String(initial.journalDate || '').trim();
  const tab = String(initial.tab || 'journal');
  return {
    accountDraft: {},
    contactErrors: {},
    account: null,
    accountTerms: null,
    accountTermsAccepted: false,
    relationships: [],
    accountRecords: [],
    error: '',
    accountJournalDate: /^\d{4}-\d{2}-\d{2}$/.test(journalDate)
      ? new Date(`${journalDate}T12:00:00`)
      : null,
    accountTab: tab,
    accountDeckOpen: false,
    accountDeckActive: tab === 'profile'
      ? 'profile'
      : (tab === 'contacts' || tab === 'contact-detail' ? 'contacts' : tab === 'integrations' ? 'integrations' : 'journal'),
    accountSelectedContactTenantId: tab === 'contact-detail' ? String(initial.tenantId || '') : '',
  };
}

function globalTermsFact(state) {
  const document = state.accountTerms || {};
  return {
    key: String(document.key || ''),
    version: Math.max(1, Number(document.version || 1)),
    accepted: Boolean(state.accountTermsAccepted),
    acceptedAt: new Date().toISOString(),
  };
}

function bookingStart(tenantId, options = {}) {
  const id = String(tenantId || '').trim();
  if (!id) return;
  const repeatRequest = options?.repeatRequest && typeof options.repeatRequest === 'object'
    ? options.repeatRequest
    : null;
  const workplaceKey = String(
    options?.workplaceKey
    || repeatRequest?.workplaceId
    || repeatRequest?.workplaceKey
    || ''
  ).trim();
  window.dispatchEvent(new CustomEvent('cova:account-booking-start', {
    detail: {
      tenantId: id,
      workplaceKey,
      repeatRequest,
      entry: repeatRequest ? 'repeat' : workplaceKey ? 'workplace' : 'profile',
    },
  }));
}

function accountCallbacks(root, state) {
  return {
    onStartBooking: bookingStart,
    onLogout: () => {
      clearAccount();
      state.account = null;
      state.relationships = [];
      state.accountRecords = [];
      state.error = '';
      renderGlobalClientEntry(root, state);
    },
  };
}

async function renderGlobalClientHome(root, state) {
  const account = state.account || await getGlobalAccount();
  if (!account) {
    renderGlobalClientEntry(root, state);
    return;
  }
  state.account = account;

  const callbacks = accountCallbacks(root, state);
  await renderGlobalAccount(root, state, callbacks);

  const tab = String(state.accountTab || 'journal');
  const profileOnly = tab === 'profile' || tab === 'profile-settings';
  const needsRelationships = tab === 'journal' || tab === 'contacts' || tab === 'contact-detail';
  const needsRecords = tab === 'journal' || tab === 'contact-detail';

  const relationshipsPromise = profileOnly
    ? getGlobalAccountBookingTargets().catch(() => [])
    : needsRelationships
      ? getGlobalAccountRelationships().catch(() => [])
      : Promise.resolve([]);
  const recordsPromise = needsRecords
    ? getGlobalAccountRecords().catch(() => [])
    : Promise.resolve([]);

  const [relationships, records] = await Promise.all([relationshipsPromise, recordsPromise]);
  if (!root.isConnected) return;

  state.relationships = Array.isArray(relationships) ? relationships : [];
  state.accountRecords = Array.isArray(records) ? records : [];
  await renderGlobalAccount(root, state, callbacks);
}

async function continueGlobalIdentity(root, state) {
  const platformState = await getGlobalAccountPlatformState();
  state.accountTerms = platformState?.document || state.accountTerms;
  state.accountTermsAccepted = Boolean(platformState?.accepted);
  if (!platformState?.accepted) {
    renderGlobalClientLegal(root, state);
    return;
  }
  await renderGlobalClientHome(root, state);
}

function renderGlobalClientEntry(root, state) {
  const rememberedIdentifier = state.accountDraft?.identifier
    || state.accountDraft?.email
    || getRememberedAccountEmail()
    || '';

  const form = formView(`
    ${field({ label: 'Телефон или email', name: 'identifier', value: rememberedIdentifier, required: true, autocomplete: 'username' })}
    ${passwordField({ label: 'Пароль', name: 'password', required: true, autocomplete: 'current-password' })}
    ${formError(state.error)}
    <button type="button" class="v2-sticker-link" data-global-account-forgot>Забыли пароль?</button>
    <button type="button" class="v2-sticker-link" data-global-account-register>Зарегистрироваться</button>
  `, { data: 'id="global-account-entry" data-global-account-entry' });

  root.innerHTML = `<section class="${flowThemeClasses()}">${v2Sticker({
    title: 'Вход',
    body: form,
    action: '<button class="ui-button" type="submit" form="global-account-entry">Войти</button>',
    className: 'v2-sticker-screen--auth',
    closeData: 'data-global-account-u-close',
  })}</section>`;

  initPasswordFields(root);
  root.querySelector('[data-global-account-u-close]')?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
  });

  const authForm = root.querySelector('[data-global-account-entry]');
  root.querySelector('[data-global-account-register]')?.addEventListener('click', async () => {
    const data = new FormData(authForm);
    const identifier = String(data.get('identifier') || '').trim();
    state.accountDraft = {
      ...(state.accountDraft || {}),
      identifier,
      ...(identifier.includes('@') ? { email: identifier.toLowerCase() } : {}),
    };
    state.error = '';
    try {
      state.accountTerms = await getAccountTerms();
      state.accountTermsAccepted = false;
      renderGlobalClientDetails(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось открыть регистрацию');
      renderGlobalClientEntry(root, state);
    }
  });

  authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validationError = formValidationMessage(authForm);
    if (validationError) {
      state.error = validationError;
      renderGlobalClientEntry(root, state);
      return;
    }

    const data = new FormData(authForm);
    const identifier = String(data.get('identifier') || '').trim();
    const password = String(data.get('password') || '');
    const submit = authForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;

    try {
      const prepared = await prepareGlobalAccount({ identifier });
      if (!prepared.exists) {
        state.accountDraft = {
          ...(state.accountDraft || {}),
          identifier,
          ...(prepared.identifierType === 'EMAIL' ? { email: identifier.toLowerCase() } : {}),
          ...(prepared.identifierType === 'PHONE' ? { phone: identifier } : {}),
        };
        state.error = 'Аккаунт не найден. Выберите «Зарегистрироваться».';
        renderGlobalClientEntry(root, state);
        return;
      }

      const payload = await loginGlobalAccount(identifier, password);
      state.account = payload.account;
      state.error = '';
      renderLoading(root);
      await continueGlobalIdentity(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось войти');
      renderGlobalClientEntry(root, state);
    }
  });
}

function renderGlobalClientDetails(root, state) {
  const draft = state.accountDraft || {};
  const contactErrors = state.contactErrors || {};

  const form = formView(`
    ${field({ label: 'Имя', name: 'name', value: draft.name || '', required: true, autocomplete: 'given-name' })}
    ${field({ label: 'Фамилия', name: 'surname', value: draft.surname || '', autocomplete: 'family-name' })}
    ${phoneField({ label: 'Телефон', name: 'phone', value: draft.phone || '', required: true })}
    ${formError(contactErrors.phone || '')}
    ${field({ label: 'Email', name: 'email', value: draft.email || '', type: 'email', required: true, autocomplete: 'email' })}
    ${formError(contactErrors.email || '')}
    ${passwordField({ label: 'Пароль', name: 'password', required: true, autocomplete: 'new-password' })}
    ${passwordField({ label: 'Повтор пароля', name: 'repeatPassword', required: true, autocomplete: 'new-password' })}
    ${formError(state.error)}
  `, { data: 'id="global-account-registration" data-global-account-form' });

  root.innerHTML = `<section class="${flowThemeClasses()}">${v2Sticker({
    title: 'Регистрация',
    body: form,
    action: '<button class="ui-button" type="submit" form="global-account-registration">Подтвердить</button>',
    className: 'v2-sticker-screen--auth',
    closeData: 'data-global-registration-u-close',
  })}</section>`;

  initPasswordFields(root);
  root.querySelector('[data-global-registration-u-close]')?.addEventListener('click', () => {
    state.error = '';
    renderGlobalClientEntry(root, state);
  });

  const registrationForm = root.querySelector('[data-global-account-form]');
  registrationForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validationError = formValidationMessage(registrationForm);
    if (validationError) {
      state.error = validationError;
      renderGlobalClientDetails(root, state);
      return;
    }

    const data = new FormData(registrationForm);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const phone = String(data.get('phone') || '').trim();
    const password = String(data.get('password') || '');
    const repeatPassword = String(data.get('repeatPassword') || '');

    if (password !== repeatPassword) {
      state.error = 'Пароли не совпадают.';
      renderGlobalClientDetails(root, state);
      return;
    }

    state.accountDraft = {
      ...(state.accountDraft || {}),
      name: String(data.get('name') || '').trim(),
      surname: String(data.get('surname') || '').trim(),
      email,
      phone,
      password,
    };

    try {
      const prepared = await prepareGlobalAccount({ email, phone });
      const conflict = 'Этот контакт уже зарегистрирован. Войдите в учетную запись.';
      state.contactErrors = {
        email: prepared?.conflicts?.email ? conflict : '',
        phone: prepared?.conflicts?.phone ? conflict : '',
      };
      if (state.contactErrors.email || state.contactErrors.phone) {
        state.error = '';
        renderGlobalClientDetails(root, state);
        return;
      }
      if (!state.accountTerms) state.accountTerms = await getAccountTerms();
      state.accountTermsAccepted = false;
      renderGlobalClientLegal(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось проверить контакты');
      renderGlobalClientDetails(root, state);
    }
  });
}

function renderGlobalClientLegal(root, state) {
  const document = state.accountTerms;
  if (!document) {
    renderLoading(root);
    void getAccountTerms()
      .then((terms) => {
        state.accountTerms = terms;
        renderGlobalClientLegal(root, state);
      })
      .catch((error) => {
        state.error = accountFlowError(error, 'Не удалось загрузить Условия использования');
        renderGlobalClientEntry(root, state);
      });
    return;
  }

  const cards = documentTiles([documentTile({
    title: document.title || 'Условия использования учетной записи',
    version: document.version || 1,
    openData: 'data-global-platform-document',
    toggleData: 'data-global-platform-toggle',
    toggleChecked: Boolean(state.accountTermsAccepted),
    aria: 'Открыть Условия использования учетной записи',
    toggleAria: 'Принять Условия использования учетной записи',
  })], { layout: 'rail' });

  root.innerHTML = `<section class="${flowThemeClasses()}">${v2Sticker({
    title: 'Документы',
    body: `${cards}${button('Продолжить', {
      data: 'data-global-platform-continue',
      disabled: !state.accountTermsAccepted,
    })}${formError(state.error)}`,
    className: 'v2-sticker-screen--legal',
    closeData: 'data-global-legal-u-close',
  })}</section>`;

  root.querySelector('[data-global-legal-u-close]')?.addEventListener('click', () => {
    if (state.account) {
      clearAccount();
      state.account = null;
      renderGlobalClientEntry(root, state);
      return;
    }
    renderGlobalClientDetails(root, state);
  });
  root.querySelector('[data-global-platform-document]')?.addEventListener('click', () => {
    openConsentDocument(document);
  });
  root.querySelector('[data-global-platform-toggle]')?.addEventListener('click', () => {
    state.accountTermsAccepted = !state.accountTermsAccepted;
    renderGlobalClientLegal(root, state);
  });
  root.querySelector('[data-global-platform-continue]')?.addEventListener('click', async (event) => {
    if (!state.accountTermsAccepted) return;
    event.currentTarget.disabled = true;
    try {
      if (!state.account) {
        const payload = await registerGlobalAccount({
          ...state.accountDraft,
          password: state.accountDraft.password,
          accountTerms: globalTermsFact(state),
        });
        state.account = payload.account;
      } else {
        await acceptGlobalAccountTerms(globalTermsFact(state));
      }
      state.error = '';
      renderLoading(root);
      await renderGlobalClientHome(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось сохранить документ');
      renderGlobalClientLegal(root, state);
    }
  });
}

export async function renderGlobalClient(root, initial = {}) {
  const state = globalAccountState(initial);
  renderLoading(root);
  try {
    const account = await getGlobalAccount();
    if (!account) {
      renderGlobalClientEntry(root, state);
      return;
    }
    state.account = account;
    await continueGlobalIdentity(root, state);
  } catch (error) {
    state.error = accountFlowError(error, 'Не удалось открыть профиль');
    renderGlobalClientEntry(root, state);
  }
}
