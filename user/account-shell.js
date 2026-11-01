import {
  accountErrorMessage,
  getAccountConsentState,
  getGlobalAccountContact,
  getGlobalAccountPlatformState,
  getGlobalAccountRelationships,
  searchGlobalAccountContacts,
  submitAccountConsents,
  updateGlobalAccount,
  deleteGlobalAccount,
  deleteGlobalAccountRelationship,
} from '../core/account/index.js';
import { formatPhone } from '../core/phone/index.js';
import { projectRecordStatuses } from '../core/record/state.js';
import { disableWebPush, enableWebPush, getWebPushState } from '../core/notifications/web-push.js';
import {
  actionBlock,
  button,
  details,
  emptyState,
  entityCardRail,
  entityCardStack,
  entityVisualCard,
  normalizeEntityCardAppearance,
  escapeHtml,
  field,
  v2ListEntries,
  v2ListEntry,
  v2CardDeck,
  v2Header,
  v2V,
  setV2V,
  clearV2V,
  modal,
  openNotice,
  page,
  shortDateTime,
  v2Section,
  v2Shell,
  v2ZLayer,
  mountV2ZLayer,
  initV2WorkspaceInteraction,
  setV2DeckOpen,
  mountModal,
  openSharedPhotoAction,
  openSharedProfileSettingsMenu,
} from '../ui/user-ui.js';
import { documentTile, documentTiles, openDocumentViewer } from '../ui/documents/index.js';
import { notificationSettings } from '../ui/settings/index.js';
import { openAccountConsentSettings } from './consent-settings.js';
import { openAccountPasswordSettings } from './password-settings.js';
import { openAccountPersonalDataZ } from './personal-data.js';
import {
  profileCardAppearance,
  profileCardFields,
  workplaceCardAppearance,
  workplaceCardFields,
} from '../core/profile/card-presentation.js';
import { renderJournal } from './journal.js';
import { renderAccountCalendarIntegrations } from './calendar-integrations.js';

function accountName(state) {
  const account = state.account || {};
  return [account.name, account.surname].filter(Boolean).join(' ').trim() || 'Профиль';
}

function accountPhoto(state) {
  const profile = state.account?.profileData && typeof state.account.profileData === 'object' ? state.account.profileData : {};
  return String(profile.photo || '');
}

const GLOBAL_ACCOUNT_ROOTS = Object.freeze([
  { id: 'profile', label: 'Профиль' },
  { id: 'journal', label: 'Журнал' },
  { id: 'contacts', label: 'Контакты' },
  { id: 'integrations', label: 'Интеграции' },
]);

function accountRootForTab(state) {
  if (state.accountTab === 'profile' || state.accountTab === 'profile-settings') return 'profile';
  if (state.accountTab === 'journal') return 'journal';
  if (state.accountTab === 'contacts' || state.accountTab === 'contact-detail') return 'contacts';
  if (state.accountTab === 'integrations') return 'integrations';
  return 'journal';
}

function accountDeck(state) {
  const fallback = accountRootForTab(state);
  if (!GLOBAL_ACCOUNT_ROOTS.some((item) => item.id === state.accountDeckActive)) state.accountDeckActive = fallback;
  return v2CardDeck(GLOBAL_ACCOUNT_ROOTS, { axis: 'x', active: state.accountDeckActive, data: 'data-account-deck-item', level: 'f' });
}

function renderV2Shell(root, state, { header, body = '', deck = true, className = '', v = null } = {}) {
  const deckMarkup = deck ? accountDeck(state) : '';
  const vMarkup = v ? v2V(v) : '';
  let shell = root.querySelector(':scope > [data-v2-app]');
  const canReuseScene = Boolean(deck && shell?.querySelector('[data-v2-card-deck][data-v2-deck-level="f"]'));

  if (!canReuseScene) {
    root.v2WorkspaceInteractionDispose?.();
    root.v2WorkspaceInteractionDispose = null;
    root.innerHTML = v2Shell({
      header,
      body,
      deck: deckMarkup,
      deckOpen: Boolean(state.accountDeckOpen && deck),
      zEnter: Boolean(state.accountZEnter),
      className,
      v: vMarkup,
    });
    shell = root.querySelector(':scope > [data-v2-app]');
  } else {
    const currentHeader = shell.querySelector(':scope > .v2-header');
    if (currentHeader) currentHeader.outerHTML = header;
    const z = shell.querySelector('[data-v2-front] > [data-v2-z]');
    if (z) z.innerHTML = body;
    const vHost = shell.querySelector(':scope > [data-v2-v-host]');
    if (vHost) { vHost.innerHTML = vMarkup; vHost.hidden = !vMarkup; }

    setV2DeckOpen(shell, Boolean(state.accountDeckOpen));
    shell.classList.toggle('is-z-entering', Boolean(state.accountZEnter && !state.accountDeckOpen));
    const preserved = ['v2-app', 'v2-app--with-deck'];
    String(className || '').split(/\s+/).filter(Boolean).forEach((name) => preserved.push(name));
    [...shell.classList].forEach((name) => {
      if (name.startsWith('v2-app--') && !preserved.includes(name) && name !== 'v2-app--with-deck') shell.classList.remove(name);
    });
    preserved.forEach((name) => shell.classList.add(name));
  }

  state.accountZEnter = false;
}

function bindWorkspaceInteraction(root, state, handlers, { bindZ = true, onZRight = null, onZLeft = null } = {}) {
  root.v2WorkspaceInteractionDispose?.();
  const fallbackF = accountRootForTab(state);
  const activeF = GLOBAL_ACCOUNT_ROOTS.some((item) => item.id === state.accountDeckActive)
    ? state.accountDeckActive
    : fallbackF;
  state.accountDeckActive = activeF;
  const dispose = initV2WorkspaceInteraction(root, {
    activeId: activeF,
    deckOpen: state.accountDeckOpen,
    bindZ,
    onZRight,
    onZLeft,
    onDeckOpenChange: (open) => { state.accountDeckOpen = open; },
    onRootSelect: (id) => {
      if (!GLOBAL_ACCOUNT_ROOTS.some((item) => item.id === id)) return;
      state.accountDeckActive = id;
      state.accountDeckOpen = false;
      state.accountZEnter = true;
      state.accountTab = id;
      void handlers.render();
    },
  });
  root.v2WorkspaceInteractionDispose = dispose;
  return () => { if (root.v2WorkspaceInteractionDispose === dispose) root.v2WorkspaceInteractionDispose = null; dispose?.(); };
}

function relationshipProfile(relationship = {}) {
  const context = relationship?.context && typeof relationship.context === 'object' ? relationship.context : {};
  const nested = context?.profile && typeof context.profile === 'object' ? context.profile : {};
  const direct = relationship?.profile && typeof relationship.profile === 'object' ? relationship.profile : {};
  const card = relationship?.card && typeof relationship.card === 'object' ? relationship.card : {};
  const cardProfile = card?.profile && typeof card.profile === 'object' ? card.profile : {};
  const source = Object.keys(direct).length ? direct : Object.keys(nested).length ? nested : cardProfile;
  return {
    ...source,
    name: String(source.name || relationship.name || card.name || '').trim(),
    surname: String(source.surname || relationship.surname || card.surname || '').trim(),
    profession: String(source.profession || relationship.profession || card.profession || '').trim(),
    phone: String(source.phone || relationship.phone || card.phone || '').trim(),
    photo: String(source.photo || source.image || source.avatar || relationship.photo || relationship.image || relationship.avatar || card.photo || card.image || card.avatar || ''),
    photoCropX: Number(source.photoCropX ?? relationship.photoCropX ?? card.photoCropX ?? 50),
    photoCropY: Number(source.photoCropY ?? relationship.photoCropY ?? card.photoCropY ?? 50),
  };
}

function relationshipTitle(relationship = {}) {
  const profile = relationshipProfile(relationship);
  return [profile.name, profile.surname].filter(Boolean).join(' ').trim() || 'Профиль';
}

function relationshipCard(relationship = {}, { interactive = true, data = '' } = {}) {
  const profile = relationshipProfile(relationship);
  const title = relationshipTitle(relationship);
  return entityVisualCard({
    appearance: profileCardAppearance(profile),
    fields: profileCardFields(profile, []),
    image: String(profile.photo || ''),
    imagePosition: `${Number(profile.photoCropX || 50)}% ${Number(profile.photoCropY || 50)}%`,
    interactive,
    data: interactive ? (data || `data-global-relationship="${escapeHtml(String(relationship.tenantId || ''))}"`) : '',
    aria: interactive ? `Открыть ${title}` : title,
  });
}

const ACCOUNT_PROFILE_CARD_APPEARANCE = normalizeEntityCardAppearance({
  lines: [
    {}, {}, {}, {}, {}, {},
    { field:'name', zone:'full', align:'left', size:'l', color:'white', bold:true },
    { field:'phone', zone:'full', align:'left', size:'m', color:'white' },
    {},
  ],
});

function profileSummary(state) {
  const account = state.account || {};
  const fullName = [account.name, account.surname].map((value) => String(value || '').trim()).filter(Boolean).join(' ') || 'Имя';
  const phone = formatPhone(account.phone || '') || String(account.phone || '') || '—';
  return entityVisualCard({
    appearance: ACCOUNT_PROFILE_CARD_APPEARANCE,
    fields: [
      { value:'name', label:'Имя и фамилия', text:fullName },
      { value:'phone', label:'Телефон', text:phone },
    ],
    image: accountPhoto(state),
    interactive: true,
    data: 'data-account-profile-card',
    aria: 'Редактировать личные данные',
  });
}

function bindGlobalRelationships(root, state, handlers) {
  const host = root.querySelector('[data-account-contact-list]');
  if (!host || host.dataset.relationshipNavigationBound === 'true') return;
  host.dataset.relationshipNavigationBound = 'true';
  host.addEventListener('click', (event) => {
    const node = event.target?.closest?.('[data-global-relationship]');
    if (!node || !host.contains(node)) return;
    const tenantId = String(node.dataset.globalRelationship || '');
    if (!tenantId) return;
    state.accountSelectedContactTenantId = tenantId;
    state.accountTab = 'contact-detail';
    state.accountDeckActive = 'contacts';
    state.accountDeckOpen = false;
    void handlers.render();
  });
}

function bindGlobalProfileSettingsEntry(root, state, handlers) {
  root.querySelector('[data-account-profile-settings]')?.addEventListener('click', () => {
    if (document.querySelector('[data-account-profile-settings-menu]')) return;
    openGlobalProfileSettingsMenu(state, handlers);
  });
}

function syncGlobalProfileHeader(root, state, handlers) {
  const current = root.querySelector('[data-v2-header]');
  if (!current) return;
  current.outerHTML = v2Header({
    a: {
      kind: 'avatar',
      label: accountName(state),
      image: accountPhoto(state),
    },
    b: accountName(state),
  });
  bindGlobalProfileSettingsEntry(root, state, handlers);
}

function accountProfileData(state) {
  return state.account?.profileData && typeof state.account.profileData === 'object'
    ? state.account.profileData
    : {};
}

async function saveAccountPhoto(state, value) {
  const account = await updateGlobalAccount({
    profileData: {
      ...accountProfileData(state),
      photo: String(value || ''),
    },
  });
  state.account = account;
  return account;
}

function openAccountPhotoSettings(state, handlers) {
  return openSharedPhotoAction({
    photo:accountPhoto(state),
    onReplace:async(src)=>{
      await saveAccountPhoto(state,src);
      await handlers.render?.();
    },
    onDelete:async()=>{
      await saveAccountPhoto(state,'');
      await handlers.render?.();
    },
    onError:(error)=>openNotice({
      title:'Фото не сохранено',
      message:accountErrorMessage(error,'Не удалось изменить фото'),
      action:'Закрыть',
      variant:'technical',
    }),
  });
}

async function loadGlobalNotificationState() {
  const pushState = await getWebPushState().catch(() => ({
    supported: false,
    enabled: false,
    subscribed: false,
    permission: 'unsupported',
  }));
  return { pushState };
}

async function openGlobalAccountControls(root, state) {
  const existing = root.querySelector('[data-account-controls-modal]');
  if (existing) return existing;

  const [notificationState, platformState] = await Promise.all([
    loadGlobalNotificationState(),
    getGlobalAccountPlatformState().catch(() => null),
  ]);
  const pushSupported = Boolean(notificationState.pushState?.supported && notificationState.pushState?.enabled);
  const pushSubscribed = Boolean(notificationState.pushState?.subscribed);
  const platformDocument = platformState?.document && typeof platformState.document === 'object'
    ? platformState.document
    : null;
  const privacyPolicy = platformState?.privacyPolicy && typeof platformState.privacyPolicy === 'object'
    ? platformState.privacyPolicy
    : null;
  const platformAccepted = Boolean(platformState?.accepted);
  const documentCards = [];
  if (platformDocument) {
    documentCards.push(documentTile({
      title: platformDocument.title || 'Условия использования учетной записи',
      version: platformDocument.version || 1,
      status: platformAccepted ? 'Принято' : 'Требует принятия',
      statusState: platformAccepted ? 'signed' : 'pending',
      data: 'data-account-platform-document',
      aria: 'Открыть Условия использования',
    }));
  }
  if (privacyPolicy) {
    documentCards.push(documentTile({
      title: privacyPolicy.title || 'Политика обработки персональных данных',
      version: privacyPolicy.version || 1,
      data: 'data-account-platform-privacy',
      aria: 'Открыть Политику обработки персональных данных',
    }));
  }
  const platformDocuments = documentCards.length
    ? documentTiles(documentCards, { layout: 'rail' })
    : emptyState('Документы недоступны', 'Не удалось загрузить документы платформы.');

  const content = `<div data-account-controls-modal>
    ${v2Section('Уведомления', notificationSettings([
      {
        label: 'Push',
        description: pushSupported ? 'Push-уведомления на этом устройстве.' : 'Push на этом устройстве сейчас недоступны.',
        checked: pushSubscribed,
        disabled: !pushSupported,
        data: 'data-account-notification-push',
      },
    ]))}
    ${v2Section('Документы', platformDocuments)}
  </div>`;

  const layer = mountModal(document.body, modal(content, {
    variant: 'q',
    title: 'Документы / Уведомления',
    className: 'modal--account-controls',
  }));

  layer?.querySelector('[data-account-notification-push]')?.addEventListener('change', async (event) => {
    const control = event.currentTarget;
    control.disabled = true;
    const status = layer.querySelector('[data-notification-status]');
    if (status) status.textContent = 'Сохраняем…';
    try {
      if (control.checked) await enableWebPush();
      else await disableWebPush();
      if (status) status.textContent = 'Сохранено.';
    } catch (error) {
      control.checked = !control.checked;
      if (status) status.textContent = accountErrorMessage(error, 'Не удалось изменить Push');
    } finally {
      control.disabled = !pushSupported;
    }
  });

  layer?.querySelector('[data-account-platform-document]')?.addEventListener('click', () => {
    if (!platformDocument) return;
    openDocumentViewer({
      title: platformDocument.title || 'Условия использования учетной записи',
      version: platformDocument.version || 1,
      content: platformDocument.content ?? platformDocument.text ?? '',
    });
  });

  layer?.querySelector('[data-account-platform-privacy]')?.addEventListener('click', () => {
    if (!privacyPolicy) return;
    openDocumentViewer({
      title: privacyPolicy.title || 'Политика обработки персональных данных',
      version: privacyPolicy.version || 1,
      content: privacyPolicy.content ?? privacyPolicy.text ?? '',
    });
  });

  return layer;
}

function confirmDeleteAccount(state, handlers) {
  const content = `<div class="form-grid">
    <div class="muted">Все действующие согласия будут отозваны. Профиль станет недоступен, исторические данные сохранятся.</div>
    ${button('Удалить профиль', { variant: 'critical', data: 'data-account-delete-confirm' })}
    ${button('Отмена', { variant: 'outline', data: 'data-account-delete-cancel' })}
  </div>`;
  const layer = mountModal(document.body, modal(content, { variant: 'x', title: 'Удалить профиль' }));
  layer?.querySelector('[data-account-delete-cancel]')?.addEventListener('click', () => layer.v2Close?.());
  layer?.querySelector('[data-account-delete-confirm]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await deleteGlobalAccount();
      layer.v2Close?.();
      handlers.onLogout?.();
    } catch (error) {
      event.currentTarget.disabled = false;
      openNotice({
        title: 'Профиль не удалён',
        message: accountErrorMessage(error, 'Не удалось удалить профиль'),
        action: 'Закрыть',
        variant:'technical',
      });
    }
  });
}

function openGlobalProfileSettingsMenu(state, handlers) {
  return openSharedProfileSettingsMenu({
    actions:[
      {id:'photo',label:'Фото',onSelect:()=>openAccountPhotoSettings(state,handlers)},
      {id:'password',label:'Изменить пароль',onSelect:()=>openAccountPasswordSettings(state)},
      {id:'controls',label:'Документы / Уведомления',onSelect:()=>void openGlobalAccountControls(document.body,state)},
      {id:'logout',label:'Выход',variant:'danger',onSelect:()=>handlers.onLogout?.()},
      {id:'delete',label:'Удалить профиль',variant:'critical',onSelect:()=>confirmDeleteAccount(state,handlers)},
    ],
    data:'data-account-profile-settings-menu',
  });
}

async function renderGlobalProfile(root, state, handlers) {
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state) },
    b: accountName(state),
  });
  renderV2Shell(root, state, {
    header,
    v: { data: 'data-account-profile-settings', aria: 'Настройки профиля' },
    body: entityCardStack([profileSummary(state)]),
  });
  bindWorkspaceInteraction(root, state, handlers);
  bindGlobalProfileSettingsEntry(root, state, handlers);

  root.querySelector('[data-account-profile-card]')?.addEventListener('click', () => {
    if (root.querySelector('.account-personal-data-z')) return;
    const editor = openAccountPersonalDataZ(root, state, {
      onDirtyChange: (dirty) => {
        if (editor) editor.dataset.accountDirty = dirty ? 'true' : 'false';
        syncGlobalProfileHeader(root, state, handlers);
      },
      onClosed: () => syncGlobalProfileHeader(root, state, handlers),
      onSaved: () => handlers.render?.(),
    });
    if (editor) editor.dataset.accountDirty = 'false';
    syncGlobalProfileHeader(root, state, handlers);
  });
}

async function renderGlobalIntegrations(root, state, handlers) {
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state) },
    b: 'Интеграции',
  });
  renderV2Shell(root, state, {
    header,
    body: '<div data-account-calendar-integrations-root></div>',
  });
  bindWorkspaceInteraction(root, state, handlers);
  const host = root.querySelector('[data-account-calendar-integrations-root]');
  if (host) await renderAccountCalendarIntegrations(host);
}

async function renderGlobalProfileSettings(root, state, handlers) {
  state.accountTab = 'profile';
  await renderGlobalProfile(root, state, handlers);
  openGlobalProfileSettingsMenu(state, handlers);
}

function disposeGlobalAccountJournal(root) {
  root.accountJournalDispose?.();
  root.accountJournalDispose = null;
}

async function renderGlobalJournal(root, state, handlers) {
  disposeGlobalAccountJournal(root);
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state) },
    b: 'Журнал',
  });
  renderV2Shell(root, state, {
    header,
    body: '<div data-account-journal-root></div>',
  });
  const journalRoot = root.querySelector('[data-account-journal-root]');
  if (journalRoot) {
    root.accountJournalDispose = renderJournal(journalRoot, {
      context: 'account',
      initialDate: state.accountJournalDate instanceof Date ? state.accountJournalDate : undefined,
      records: () => Array.isArray(state.accountRecords) ? state.accountRecords : [],
    }) || null;
  }
  bindWorkspaceInteraction(root, state, handlers);
}

function relationshipSearchText(relationship = {}) {
  return relationshipTitle(relationship).toLocaleLowerCase('ru-RU');
}

function contactsBody(relationships = [], query = '') {
  const needle = String(query || '').trim().toLocaleLowerCase('ru-RU');
  const filtered = needle
    ? relationships.filter((relationship) => relationshipSearchText(relationship).includes(needle))
    : relationships;
  if (!filtered.length) {
    return emptyState(needle ? 'Ничего не найдено' : 'Контактов пока нет', needle ? 'Измени имя в поиске.' : 'Новые контакты появятся здесь.');
  }
  return entityCardStack(filtered.map(relationshipCard));
}

async function refreshRelationships(state) {
  const relationships = await getGlobalAccountRelationships();
  state.relationships = Array.isArray(relationships) ? relationships : [];
  state.relationshipsLoaded = true;
  return state.relationships;
}

function systemSearchResults(results = []) {
  if (!results.length) return emptyState('Ничего не найдено', 'Проверь номер телефона.');
  return results.map((relationship, index) => {
    const status = relationship?.connected
      ? '<div class="muted">Уже в контактах</div>'
      : button('Добавить', { data: `data-account-system-add="${index}"` });
    return `<div class="form-grid" data-account-system-result="${index}">${relationshipCard(relationship, { interactive: false })}${status}</div>`;
  }).join('');
}

function openGlobalSystemSearch(state, handlers) {
  const content = `<form class="form-grid" data-account-system-search-form>
    ${field({ label: 'Телефон', name: 'accountSystemPhone', type: 'tel', autocomplete: 'tel', placeholder: '+7 000 000-00-00' })}
    ${button('Найти', { data: 'data-account-system-search-submit' })}
    <div class="form-error" data-account-system-search-error></div>
    <div data-account-system-search-results></div>
  </form>`;
  const layer = mountModal(document.body, modal(content, { variant: 'x', title: 'Поиск в системе' }));
  if (!layer) return null;

  const form = layer.querySelector('[data-account-system-search-form]');
  const resultsHost = layer.querySelector('[data-account-system-search-results]');
  const errorHost = layer.querySelector('[data-account-system-search-error]');
  let results = [];

  const renderResults = () => {
    if (!resultsHost) return;
    resultsHost.innerHTML = systemSearchResults(results);
    resultsHost.querySelectorAll('[data-account-system-add]').forEach((control) => control.addEventListener('click', async () => {
      const relationship = results[Number(control.dataset.accountSystemAdd)];
      const tenantId = String(relationship?.tenantId || '');
      if (!tenantId) return;
      control.disabled = true;
      try {
        const consentState = await submitAccountConsents(tenantId, []);
        if (consentState?.pdnActive) {
          await refreshRelationships(state);
          relationship.connected = true;
          renderResults();
          if (state.accountTab === 'contacts') await handlers.render?.();
          return;
        }
        layer.v2Close?.();
        await openAccountConsentSettings(state, {
          tenantId,
          onChanged: async (documentId) => {
            if (String(documentId || '') !== 'pdn-consent') return;
            const next = await getAccountConsentState(tenantId).catch(() => null);
            if (!next?.pdnActive) return;
            await refreshRelationships(state);
            if (state.accountTab === 'contacts') await handlers.render?.();
          },
        });
      } catch (error) {
        control.disabled = false;
        if (errorHost) errorHost.textContent = accountErrorMessage(error, 'Не удалось добавить контакт');
      }
    }));
  };

  const search = async () => {
    const phone = String(new FormData(form).get('accountSystemPhone') || '').trim();
    if (errorHost) errorHost.textContent = '';
    if (resultsHost) resultsHost.innerHTML = '<div class="muted">Поиск…</div>';
    try {
      const payload = await searchGlobalAccountContacts(phone);
      results = Array.isArray(payload) ? payload : [];
      renderResults();
    } catch (error) {
      results = [];
      if (resultsHost) resultsHost.innerHTML = '';
      if (errorHost) errorHost.textContent = accountErrorMessage(error, 'Не удалось выполнить поиск в системе');
    }
  };

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    void search();
  });
  layer.querySelector('[data-account-system-search-submit]')?.addEventListener('click', (event) => {
    event.preventDefault();
    void search();
  });
  return layer;
}

function openGlobalContactsSettings(state, handlers) {
  return openSharedProfileSettingsMenu({
    title: 'Контакты',
    actions: [
      { id: 'system-search', label: 'Поиск в системе', onSelect: () => openGlobalSystemSearch(state, handlers) },
    ],
    data: 'data-global-contacts-settings-menu',
  });
}

async function renderGlobalContacts(root, state, handlers) {
  const relationships = Array.isArray(state.relationships) ? state.relationships : [];
  const searchable = relationships.length > 15;
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state) },
    b: 'Контакты',
  });
  renderV2Shell(root, state, {
    header,
    v: { data: 'data-global-contacts-settings', aria: 'Действия контактов' },
    body: `${searchable ? field({ name: 'accountContactSearch', type: 'search', placeholder: 'Поиск по имени', autocomplete: 'off', data: 'data-account-contact-search' }) : ''}<div data-account-contact-list>${contactsBody(relationships)}</div>`,
  });
  bindWorkspaceInteraction(root, state, handlers);
  bindGlobalRelationships(root, state, handlers);
  root.querySelector('[data-global-contacts-settings]')?.addEventListener('click', () => openGlobalContactsSettings(state, handlers));
  const search = root.querySelector('[data-account-contact-search]');
  search?.addEventListener('input', () => {
    const host = root.querySelector('[data-account-contact-list]');
    if (!host) return;
    host.innerHTML = contactsBody(relationships, search.value);
    bindGlobalRelationships(root, state, handlers);
  });
}

function selectedGlobalRelationship(state) {
  const tenantId = String(state.accountSelectedContactTenantId || '');
  return (Array.isArray(state.relationships) ? state.relationships : [])
    .find((relationship) => String(relationship?.tenantId || '') === tenantId) || null;
}

async function loadGlobalContactDetail(state, relationship) {
  if (!relationship?.tenantId || relationship.__contactDetailLoaded) return relationship;
  const detail = await getGlobalAccountContact(relationship.tenantId);
  const merged = { ...relationship, ...detail, __contactDetailLoaded: true };
  const index = (Array.isArray(state.relationships) ? state.relationships : [])
    .findIndex((item) => String(item?.tenantId || '') === String(relationship.tenantId || ''));
  if (index >= 0) state.relationships.splice(index, 1, merged);
  return merged;
}

function contactWorkplaceCard(relationship, workplace, { interactive = true } = {}) {
  const profile = relationshipProfile(relationship);
  return entityVisualCard({
    appearance: workplaceCardAppearance(workplace),
    fields: workplaceCardFields(workplace, profile),
    image: String(workplace?.photo || ''),
    imagePosition: `${Number(workplace?.photoCropX || 50)}% ${Number(workplace?.photoCropY || 50)}%`,
    interactive,
    data: interactive ? `data-global-contact-workplace="${escapeHtml(String(workplace?.key || ''))}"` : '',
    aria: interactive ? `Открыть ${String(workplace?.name || 'пространство')}` : String(workplace?.name || 'Пространство'),
  });
}

function openGlobalContactWorkplaceQ(relationship, workplace) {
  const rows = [
    workplace?.city ? { label: 'Город', value: String(workplace.city) } : null,
    workplace?.address ? { label: 'Адрес', value: String(workplace.address) } : null,
    workplace?.phone ? { label: 'Телефон', value: formatPhone(workplace.phone) || String(workplace.phone) } : null,
    workplace?.about ? { label: 'Описание', value: String(workplace.about) } : null,
  ].filter(Boolean);
  const content = `${entityCardStack([contactWorkplaceCard(relationship, workplace, { interactive: false })])}${rows.length ? details(rows) : ''}`;
  return mountModal(document.body, modal(content, {
    variant: 'q',
    title: String(workplace?.name || 'Пространство'),
  }));
}

function confirmDeleteGlobalContact(state, handlers, relationship) {
  const tenantId = String(relationship?.tenantId || '');
  const title = relationshipTitle(relationship);
  if (!tenantId) return;
  const layer = mountModal(document.body, modal(`<div class="modal-title"><h2>Удалить контакт?</h2><p>${escapeHtml(title)} будет убран из Контактов. Все действующие согласия будут отозваны.</p></div><div class="form-error" data-contact-delete-error></div><div class="modal-actions">${button('Удалить', { variant: 'danger', data: 'data-confirm-delete-contact' })}${button('Отмена', { variant: 'secondary', data: 'data-cancel-delete-contact' })}</div>`, { variant: 'x', title: 'Удаление контакта' }));
  layer?.querySelector('[data-cancel-delete-contact]')?.addEventListener('click', () => layer.v2Close?.());
  layer?.querySelector('[data-confirm-delete-contact]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await deleteGlobalAccountRelationship(tenantId);
      state.relationships = (Array.isArray(state.relationships) ? state.relationships : [])
        .filter((item) => String(item?.tenantId || '') !== tenantId);
      state.accountSelectedContactTenantId = '';
      state.accountTab = 'contacts';
      state.accountDeckActive = 'contacts';
      layer.v2Close?.();
      await handlers.render?.();
    } catch (error) {
      event.currentTarget.disabled = false;
      const errorNode = layer.querySelector('[data-contact-delete-error]');
      if (errorNode) errorNode.textContent = accountErrorMessage(error, 'Не удалось удалить контакт');
    }
  });
}

function openGlobalContactSettings(state, handlers, relationship) {
  const tenantId = String(relationship?.tenantId || '');
  if (!tenantId) return null;
  return openSharedProfileSettingsMenu({
    title: 'Настройки',
    actions: [
      { id: 'consents', label: 'Согласия', onSelect: () => void openAccountConsentSettings(state, { tenantId, onChanged: () => {} }) },
      { id: 'delete', label: 'Удалить', variant: 'critical', onSelect: () => confirmDeleteGlobalContact(state, handlers, relationship) },
    ],
    data: 'data-global-contact-settings-menu',
  });
}

async function renderGlobalContactDetail(root, state, handlers) {
  let relationship = selectedGlobalRelationship(state);
  if (!relationship) {
    state.accountTab = 'contacts';
    state.accountDeckActive = 'contacts';
    await handlers.render();
    return;
  }
  try {
    relationship = await loadGlobalContactDetail(state, relationship);
  } catch (error) {
    openNotice({
      title: 'Контакт не открыт',
      message: accountErrorMessage(error, 'Не удалось загрузить данные контакта'),
      action: 'Закрыть',
      variant: 'technical',
    });
  }
  const profile = relationshipProfile(relationship);
  const title = relationshipTitle(relationship);
  const workplaces = Array.isArray(relationship?.workplaces) ? relationship.workplaces : [];
  const workplaceRail = workplaces.length
    ? v2Section('Пространства', entityCardRail(workplaces.map((workplace) => contactWorkplaceCard(relationship, workplace))))
    : '';
  renderV2Shell(root, state, {
    header: v2Header({
      a: { kind: 'avatar', label: title, image: String(profile.photo || '') },
      b: title,
    }),
    v: { data: 'data-global-contact-settings', aria: 'Настройки контакта' },
    body: `${entityCardStack([relationshipCard(relationship, { interactive: false })])}${workplaceRail}`,
  });
  bindWorkspaceInteraction(root, state, handlers);
  root.querySelector('[data-global-contact-settings]')?.addEventListener('click', () => openGlobalContactSettings(state, handlers, relationship));
  root.querySelectorAll('[data-global-contact-workplace]').forEach((node) => node.addEventListener('click', () => {
    const workplace = workplaces.find((item) => String(item?.key || '') === String(node.dataset.globalContactWorkplace || ''));
    if (workplace) openGlobalContactWorkplaceQ(relationship, workplace);
  }));
}

export async function renderGlobalAccount(root, state, callbacks = {}) {
  state.globalAccount = true;
  state.accountTab ||= 'journal';
  state.accountDeckOpen = Boolean(state.accountDeckOpen);
  state.accountZEnter = Boolean(state.accountZEnter);
  if (!GLOBAL_ACCOUNT_ROOTS.some((item) => item.id === state.accountDeckActive)) state.accountDeckActive = accountRootForTab(state);
  if (state.accountTab !== 'journal') disposeGlobalAccountJournal(root);

  const handlers = {
    render: () => renderGlobalAccount(root, state, callbacks),
    onStartRecord: callbacks.onStartRecord,
    onLogout: callbacks.onLogout,
  };

  if (state.accountTab === 'profile-settings') return renderGlobalProfileSettings(root, state, handlers);
  if (state.accountTab === 'profile') return renderGlobalProfile(root, state, handlers);
  if (state.accountTab === 'integrations') return renderGlobalIntegrations(root, state, handlers);
  if (state.accountTab === 'journal') return renderGlobalJournal(root, state, handlers);
  if (state.accountTab === 'contact-detail') return renderGlobalContactDetail(root, state, handlers);
  if (state.accountTab === 'contacts') return renderGlobalContacts(root, state, handlers);
  return renderGlobalJournal(root, state, handlers);
}
