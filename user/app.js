import {
  acceptGlobalAccountTerms,
  accountErrorMessage,
  clearAccount,
  getAccountTerms,
  getAccountToken,
  getGlobalAccount,
  getGlobalAccountPlatformState,
  getGlobalAccountRecords,
  getGlobalAccountRelationships,
  getRememberedAccountIdentifier,
  isAccountSystemError,
  loginGlobalAccount,
  prepareGlobalAccount,
  registerGlobalAccount,
} from '../core/account/index.js';
import { ensureAccountEmailVerification } from '../core/account/email.js';
import { button } from '../ui/buttons/index.js';
import { documentTile, documentTiles, openDocumentViewer } from '../ui/documents/index.js';
import { field, formValidationMessage, initPasswordFields, passwordField, phoneField } from '../ui/inputs/index.js';
import { openNotice } from '../ui/modals/index.js';
import { v2Sticker } from '../ui/v2/sticker.js';
import { formError, formView } from '../ui/forms/index.js';

let shellPromise = null;

function loadShell() {
  if (!shellPromise) shellPromise = import('./account-shell.js');
  return shellPromise;
}

async function renderShell(root, state, callbacks) {
  const { renderGlobalAccount } = await loadShell();
  return renderGlobalAccount(root, state, callbacks);
}

function renderLoading(root) {
  root.innerHTML = '<div class="app-bootstrap" role="status">Загрузка…</div>';
}

function renderProfileUnavailable(root, initial = {}) {
  root.innerHTML = `<section class="user-account">${v2Sticker({
    title: 'Не удалось загрузить профиль',
    body: 'Проверьте соединение и повторите попытку.',
    action: '<button class="ui-button" type="button" data-user-profile-retry>Повторить</button>',
    className: 'v2-sticker-screen--auth',
  })}</section>`;
  root.querySelector('[data-user-profile-retry]')?.addEventListener('click', () => {
    void renderUser(root, initial);
  });
}

function userError(error, fallbackMessage) {
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

function openPlatformDocument(document = {}) {
  return openDocumentViewer({
    title: document?.title || 'Документ',
    version: document?.version || 1,
    content: document?.content ?? document?.text ?? '',
  });
}

function createState(initial = {}) {
  const journalDate = String(initial.journalDate || '').trim();
  const tab = String(initial.tab || 'journal');
  return {
    accountDraft: {},
    contactErrors: {},
    account: null,
    accountTerms: null,
    accountTermsAccepted: false,
    relationships: [],
    relationshipsLoaded: false,
    relationshipsPromise: null,
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

function termsFact(state) {
  const document = state.accountTerms || {};
  return {
    key: String(document.key || ''),
    version: Math.max(1, Number(document.version || 1)),
    accepted: Boolean(state.accountTermsAccepted),
    acceptedAt: new Date().toISOString(),
  };
}

function startRecord(contactId, options = {}) {
  const id = String(contactId || '').trim();
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
  window.dispatchEvent(new CustomEvent('cova:user-record-start', {
    detail: {
      contactId: id,
      workplaceKey,
      repeatRequest,
    },
  }));
}

async function loadRelationships(state) {
  if (state.relationshipsLoaded) return state.relationships;
  if (!state.relationshipsPromise) {
    state.relationshipsPromise = getGlobalAccountRelationships()
      .then((relationships) => {
        state.relationships = Array.isArray(relationships) ? relationships : [];
        state.relationshipsLoaded = true;
        return state.relationships;
      })
      .finally(() => {
        state.relationshipsPromise = null;
      });
  }
  return state.relationshipsPromise;
}

function shellCallbacks(root, state) {
  return {
    onStartRecord: startRecord,
    onLogout: () => {
      clearAccount();
      state.account = null;
      state.relationships = [];
      state.relationshipsLoaded = false;
      state.relationshipsPromise = null;
      state.accountRecords = [];
      state.error = '';
      renderEntry(root, state);
    },
  };
}

function installRelationshipLoading(root, state) {
  root.userRelationshipState = state;
  if (root.userRelationshipLoaderBound) return;
  root.userRelationshipLoaderBound = true;
  root.addEventListener('click', (event) => {
    const target = event.target?.closest?.('[data-account-deck-item="contacts"]');
    if (!target || !root.contains(target)) return;
    const current = root.userRelationshipState;
    if (!current || current.relationshipsLoaded) return;
    void loadRelationships(current)
      .then(() => {
        if (!root.isConnected || root.userRelationshipState !== current) return;
        if (current.accountTab !== 'contacts' && current.accountTab !== 'contact-detail') return;
        return renderShell(root, current, shellCallbacks(root, current));
      })
      .catch(() => {});
  }, true);
}

async function renderHome(root, state) {
  const account = state.account || await getGlobalAccount();
  if (!account) {
    renderEntry(root, state);
    return;
  }
  state.account = account;
  installRelationshipLoading(root, state);

  const callbacks = shellCallbacks(root, state);
  const tab = String(state.accountTab || 'journal');
  if (tab === 'contacts' || tab === 'contact-detail') {
    await loadRelationships(state).catch(() => []);
  }

  await renderShell(root, state, callbacks);

  if (tab !== 'journal') return;
  const records = await getGlobalAccountRecords().catch(() => []);
  if (!root.isConnected) return;
  state.accountRecords = Array.isArray(records) ? records : [];
  await renderShell(root, state, callbacks);
}

async function continueIdentity(root, state) {
  const platformState = await getGlobalAccountPlatformState();
  state.accountTerms = platformState?.document || state.accountTerms;
  state.accountTermsAccepted = Boolean(platformState?.accepted);
  if (!platformState?.accepted) {
    renderLegal(root, state);
    return;
  }
  await renderHome(root, state);
}

function renderEntry(root, state) {
  root.userRelationshipState = state;
  const rememberedIdentifier = state.accountDraft?.identifier
    || state.accountDraft?.email
    || state.accountDraft?.phone
    || getRememberedAccountIdentifier()
    || '';

  const form = formView(`
    ${field({ label: 'Телефон или email', name: 'identifier', value: rememberedIdentifier, required: true, autocomplete: 'username' })}
    ${passwordField({ label: 'Пароль', name: 'password', required: true, autocomplete: 'current-password' })}
    ${formError(state.error)}
    <button type="button" class="v2-sticker-link" data-global-account-forgot>Забыли пароль?</button>
    <button type="button" class="v2-sticker-link" data-global-account-register>Зарегистрироваться</button>
  `, { data: 'id="global-account-entry" data-global-account-entry' });

  root.innerHTML = `<section class="user-account">${v2Sticker({
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
      ...(identifier.includes('@') ? { email: identifier.toLowerCase() } : { phone: identifier }),
    };
    state.error = '';
    try {
      state.accountTerms = await getAccountTerms();
      state.accountTermsAccepted = false;
      renderDetails(root, state);
    } catch (error) {
      state.error = userError(error, 'Не удалось открыть регистрацию');
      renderEntry(root, state);
    }
  });

  authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validationError = formValidationMessage(authForm);
    if (validationError) {
      state.error = validationError;
      renderEntry(root, state);
      return;
    }

    const data = new FormData(authForm);
    const identifier = String(data.get('identifier') || '').trim();
    const password = String(data.get('password') || '');
    const submit = authForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;

    let loginSucceeded = false;
    try {
      const payload = await loginGlobalAccount(identifier, password);
      loginSucceeded = true;
      state.account = payload.account;
      state.error = '';
      void ensureAccountEmailVerification().catch(() => {});
      await continueIdentity(root, state);
    } catch (error) {
      if (loginSucceeded) {
        if (root.isConnected) renderProfileUnavailable(root);
        return;
      }
      state.error = userError(error, 'Не удалось войти');
      renderEntry(root, state);
    }
  });
}

function renderDetails(root, state) {
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

  root.innerHTML = `<section class="user-account">${v2Sticker({
    title: 'Регистрация',
    body: form,
    action: '<button class="ui-button" type="submit" form="global-account-registration">Подтвердить</button>',
    className: 'v2-sticker-screen--auth',
    closeData: 'data-global-registration-u-close',
  })}</section>`;

  initPasswordFields(root);
  root.querySelector('[data-global-registration-u-close]')?.addEventListener('click', () => {
    state.error = '';
    renderEntry(root, state);
  });

  const registrationForm = root.querySelector('[data-global-account-form]');
  registrationForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validationError = formValidationMessage(registrationForm);
    if (validationError) {
      state.error = validationError;
      renderDetails(root, state);
      return;
    }

    const data = new FormData(registrationForm);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const phone = String(data.get('phone') || '').trim();
    const password = String(data.get('password') || '');
    const repeatPassword = String(data.get('repeatPassword') || '');

    if (password !== repeatPassword) {
      state.error = 'Пароли не совпадают.';
      renderDetails(root, state);
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
        renderDetails(root, state);
        return;
      }
      if (!state.accountTerms) state.accountTerms = await getAccountTerms();
      state.accountTermsAccepted = false;
      renderLegal(root, state);
    } catch (error) {
      state.error = userError(error, 'Не удалось проверить контакты');
      renderDetails(root, state);
    }
  });
}

function renderLegal(root, state) {
  const document = state.accountTerms;
  if (!document) {
    renderLoading(root);
    void getAccountTerms()
      .then((terms) => {
        state.accountTerms = terms;
        renderLegal(root, state);
      })
      .catch((error) => {
        state.error = userError(error, 'Не удалось загрузить Условия использования');
        renderEntry(root, state);
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

  root.innerHTML = `<section class="user-account">${v2Sticker({
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
      renderEntry(root, state);
      return;
    }
    renderDetails(root, state);
  });
  root.querySelector('[data-global-platform-document]')?.addEventListener('click', () => {
    openPlatformDocument(document);
  });
  root.querySelector('[data-global-platform-toggle]')?.addEventListener('click', () => {
    state.accountTermsAccepted = !state.accountTermsAccepted;
    renderLegal(root, state);
  });
  root.querySelector('[data-global-platform-continue]')?.addEventListener('click', async (event) => {
    if (!state.accountTermsAccepted) return;
    event.currentTarget.disabled = true;
    try {
      if (!state.account) {
        const payload = await registerGlobalAccount({
          ...state.accountDraft,
          password: state.accountDraft.password,
          accountTerms: termsFact(state),
        });
        state.account = payload.account;
        void ensureAccountEmailVerification().catch(() => {});
      } else {
        await acceptGlobalAccountTerms(termsFact(state));
      }
      state.error = '';
      await renderHome(root, state);
    } catch (error) {
      state.error = userError(error, 'Не удалось сохранить документ');
      renderLegal(root, state);
    }
  });
}

export async function renderUser(root, initial = {}) {
  const state = createState(initial);
  root.userRelationshipState = state;
  if (!getAccountToken()) {
    renderEntry(root, state);
    return;
  }
  renderLoading(root);

  try {
    const [account, platformState] = await Promise.all([
      getGlobalAccount(),
      getGlobalAccountPlatformState(),
    ]);
    if (!root.isConnected) return;
    if (!account) {
      renderEntry(root, state);
      return;
    }

    state.account = account;
    state.accountTerms = platformState?.document || state.accountTerms;
    state.accountTermsAccepted = Boolean(platformState?.accepted);
    if (!platformState?.accepted) {
      renderLegal(root, state);
      return;
    }
    await renderHome(root, state);
  } catch {
    if (!root.isConnected) return;
    if (!getAccountToken()) {
      renderEntry(root, state);
      return;
    }
    renderProfileUnavailable(root, initial);
  }
}
