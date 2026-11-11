import {
  accountErrorMessage,
  getGlobalAccountContact,
  getGlobalAccountPlatformState,
  getGlobalAccountRelationships,
  getGlobalContactWorkplaceHistory,
  getGlobalContactRecord,
  getGlobalContactPersonalAccount,
  getGlobalContactDeposit,
  searchGlobalAccountContacts,
  submitAccountConsents,
  updateGlobalAccount,
  deleteGlobalAccount,
  deleteGlobalAccountRelationship,
} from '../core/account/index.js';
import { formatPhone } from '../core/phone/index.js';
import { getRecordContacts } from '../core/record/platform-api.js';
import { projectRecordStatuses } from '../core/record/state.js';
import { disableWebPush, enableWebPush, getWebPushState } from '../core/notifications/web-push.js';
import { getAccountEmailVerification } from '../core/account/email.js';
import {
  actionBlock,
  button,
  details,
  emptyState,
  entityCardRail,
  entityCardStack,
  entityVisualCard,
  normalizeEntityCardAppearance,
  hasConfiguredEntityCardAppearance,
  recordMiniCard,
  miniCardRail,
  miniCardStack,
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
import { readOnlyReceipt } from '../ui/receipt/index.js';
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

// Core projects the precise Professional card: its nine lines, ordered values,
// photo and crop. User must never rearrange or fill any missing positioned field.
// A legacy fallback is used only while an older API omits card entirely.
// Never treat a projected card with nine EMPTY rows as a configured
// Professional design. The source appearance may still be present on the
// public profile/workplace when the projection is incomplete.
function professionalContactCard(card = null, source = {}) {
  const configured = hasConfiguredEntityCardAppearance(card?.appearance)
    ? card.appearance
    : hasConfiguredEntityCardAppearance(source.appearance) ? source.appearance : null;
  if (!configured) return null;
  const projectedFields = Array.isArray(card?.fields) ? card.fields : [];
  // When the projection lost ALL values, restore only already-public fields
  // from the same payload. Never infer positions or expose private fields.
  const hasProjectedValues = projectedFields.some((item) => String(item?.text ?? '').trim() !== '');
  const fields = hasProjectedValues ? projectedFields
    : Array.isArray(source.fields) ? source.fields : projectedFields;
  return {
    appearance: configured,
    fields,
    image: String(card?.photo || source.image || ''),
    imagePosition: String(card?.photoPosition || source.imagePosition || '50% 50%'),
  };
}

function relationshipCard(relationship = {}, { interactive = true, data = '' } = {}) {
  const profile = relationshipProfile(relationship);
  const title = relationshipTitle(relationship);
  const supplied = {
    appearance: profile.cardAppearance,
    fields: profileCardFields(profile, []),
    image: String(profile.photo || ''),
    imagePosition: `${Number(profile.photoCropX ?? 50)}% ${Number(profile.photoCropY ?? 50)}%`,
  };
  const view = professionalContactCard(profile.card, supplied) || {
    ...supplied,
    appearance: profileCardAppearance(profile),
  };
  return entityVisualCard({
    ...view,
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
    state.accountDeckActive = 'contacts';
    state.accountDeckOpen = false;
    void openGlobalContactDetailZ(root, state, handlers);
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
  const [pushState, emailState] = await Promise.all([
    getWebPushState().catch(() => ({
      supported: false,
      enabled: false,
      subscribed: false,
      permission: 'unsupported',
    })),
    getAccountEmailVerification().catch(() => ({ unavailable: true, verified: false, email: '' })),
  ]);
  return { pushState, emailState };
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
  const emailAvailable = notificationState.emailState?.unavailable !== true;
  const emailVerified = emailAvailable && notificationState.emailState?.verified === true;
  const accountEmail = String(notificationState.emailState?.email || state.account?.email || '').trim();
  const platformDocument = platformState?.document && typeof platformState.document === 'object'
    ? platformState.document
    : null;
  const privacyPolicy = platformState?.privacyPolicy && typeof platformState.privacyPolicy === 'object'
    ? platformState.privacyPolicy
    : null;
  const platformAccepted = Boolean(platformState?.accepted);
  // The platform API already returns the actual recorded acceptance moment.
  // Show its date; never substitute today's date or the document's issue date.
  const acceptedDay = String(platformState?.acceptedAt || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const acceptedDate = acceptedDay ? `${acceptedDay[3]}.${acceptedDay[2]}.${acceptedDay[1].slice(-2)}` : '';
  const documentCards = [];
  if (platformDocument) {
    documentCards.push(documentTile({
      title: platformDocument.title || 'Условия использования учетной записи',
      version: platformDocument.version || 1,
      meta: platformAccepted && acceptedDate ? acceptedDate : '',
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
      {
        label: 'Email',
        description: !emailAvailable
          ? 'Не удалось проверить подтверждение адреса.'
          : emailVerified
            ? `Email аккаунта ${accountEmail} подтверждён.`
            : `Email аккаунта ${accountEmail} не подтверждён.`,
        checked: emailVerified,
        disabled: true,
        data: 'data-account-notification-email-status',
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
    const workplaceNames = new Map((Array.isArray(state.relationships) ? state.relationships : [])
      .flatMap((relationship) => (Array.isArray(relationship.workplaces) ? relationship.workplaces : [])
        .map((workplace) => [
          JSON.stringify([String(relationship.tenantId || ''), String(workplace.key || '')]),
          String(workplace.name || ''),
        ])));
    root.accountJournalDispose = renderJournal(journalRoot, {
      context: 'account',
      initialDate: state.accountJournalDate instanceof Date ? state.accountJournalDate : undefined,
      records: () => (Array.isArray(state.accountRecords) ? state.accountRecords : []).map((record) => ({
        ...record,
        workplaceName: String(record.workplaceName || '') || workplaceNames.get(JSON.stringify([
          String(record.tenantId || ''), String(record.workplaceId || record.workplaceKey || ''),
        ])) || '',
      })),
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

async function getContactRecordAllowed(tenantId) {
  const id = String(tenantId || '').trim();
  if (!id) return false;
  try {
    const targets = await getRecordContacts();
    return (Array.isArray(targets) ? targets : [])
      .some((target) => String(target?.tenantId || '').trim() === id);
  } catch {
    return null;
  }
}

function syncContactRecordAction(layer, tenantId, handlers, allowed) {
  const host = layer?.querySelector('[data-global-contact-record-action]');
  if (!host) return;
  host.innerHTML = allowed
    ? `<div class="modal-actions">${button('Записаться', { data: 'data-global-contact-record' })}</div>`
    : '';
  host.querySelector('[data-global-contact-record]')?.addEventListener('click', () => {
    handlers.onStartRecord?.(tenantId);
  });
}

async function openContactConsentQ(state, handlers, relationship, detailLayer) {
  const tenantId = String(relationship?.tenantId || '').trim();
  if (!tenantId) return null;
  return openAccountConsentSettings(state, {
    tenantId,
    getRecordAllowed: () => getContactRecordAllowed(tenantId),
    onRecord: () => handlers.onStartRecord?.(tenantId),
    onChanged: async (_documentId, { recordAllowed } = {}) => {
      syncContactRecordAction(detailLayer, tenantId, handlers, Boolean(recordAllowed));
      await refreshRelationships(state).catch(() => []);
    },
  });
}

function systemSearchResults(results = []) {
  if (!results.length) return emptyState('Ничего не найдено', 'Проверь номер телефона.');
  return results.map((relationship, index) => {
    const status = relationship?.connected ? '<div class="muted">Уже в контактах</div>' : '';
    return `<div class="form-grid" data-account-system-result="${index}">${relationshipCard(relationship, { interactive: false })}${status}</div>`;
  }).join('');
}

function openGlobalSystemSearch(state, handlers) {
  const content = `<form class="form-grid" data-account-system-search-form>
    ${field({ label: 'Телефон', name: 'accountSystemPhone', type: 'tel', autocomplete: 'tel', placeholder: '+7 000 000-00-00' })}
    <div class="form-error" data-account-system-search-error></div>
    <div data-account-system-search-results></div>
    ${button('Найти', { data: 'data-account-system-search-action' })}
  </form>`;
  const layer = mountModal(document.body, modal(content, { variant: 'x', title: 'Поиск в системе' }));
  if (!layer) return null;

  const form = layer.querySelector('[data-account-system-search-form]');
  const resultsHost = layer.querySelector('[data-account-system-search-results]');
  const errorHost = layer.querySelector('[data-account-system-search-error]');
  const action = layer.querySelector('[data-account-system-search-action]');
  const phoneInput = form?.querySelector('[name="accountSystemPhone"]');
  let results = [];
  let addTarget = null;
  let actionMode = 'search';

  const setActionMode = (mode = 'search') => {
    actionMode = mode === 'add' ? 'add' : 'search';
    if (!action) return;
    action.textContent = actionMode === 'add' ? 'Добавить' : 'Найти';
    action.hidden = false;
    action.disabled = false;
  };

  const renderResults = () => {
    if (!resultsHost) return;
    resultsHost.innerHTML = systemSearchResults(results);
    addTarget = results.find((relationship) => !relationship?.connected) || null;
    if (addTarget) setActionMode('add');
    else if (results.length) {
      setActionMode('search');
      if (action) action.hidden = true;
    } else setActionMode('search');
  };

  const search = async () => {
    const phone = String(new FormData(form).get('accountSystemPhone') || '').trim();
    if (errorHost) errorHost.textContent = '';
    if (resultsHost) resultsHost.innerHTML = '<div class="muted">Поиск…</div>';
    if (action) action.disabled = true;
    try {
      const payload = await searchGlobalAccountContacts(phone);
      results = Array.isArray(payload) ? payload : [];
      renderResults();
    } catch (error) {
      results = [];
      addTarget = null;
      if (resultsHost) resultsHost.innerHTML = '';
      if (errorHost) errorHost.textContent = accountErrorMessage(error, 'Не удалось выполнить поиск в системе');
      setActionMode('search');
    } finally {
      if (action && !action.hidden) action.disabled = false;
    }
  };

  const add = async () => {
    const relationship = addTarget;
    const tenantId = String(relationship?.tenantId || '');
    if (!tenantId || !action) return;
    action.disabled = true;
    if (errorHost) errorHost.textContent = '';
    try {
      await submitAccountConsents(tenantId, []);
      await refreshRelationships(state);
      relationship.connected = true;
      addTarget = null;
      renderResults();
      if (state.accountTab === 'contacts') await handlers.render?.();
    } catch (error) {
      action.disabled = false;
      if (errorHost) errorHost.textContent = accountErrorMessage(error, 'Не удалось добавить контакт');
    }
  };

  phoneInput?.addEventListener('input', () => {
    if (!results.length && actionMode === 'search') return;
    results = [];
    addTarget = null;
    if (resultsHost) resultsHost.innerHTML = '';
    if (errorHost) errorHost.textContent = '';
    setActionMode('search');
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (actionMode === 'add') void add();
    else void search();
  });
  action?.addEventListener('click', (event) => {
    event.preventDefault();
    if (actionMode === 'add') void add();
    else void search();
  });
  return layer;
}

function openGlobalContactsSettings(state, handlers) {
  return openGlobalSystemSearch(state, handlers);
}

function bindGlobalContactsV(root, state, handlers) {
  const control = setV2V(root, { data: 'data-global-contacts-settings', aria: 'Действия контактов' });
  control?.addEventListener('click', () => openGlobalContactsSettings(state, handlers));
  return control;
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

function money(value) {
  const number = Number(value || 0);
  return `${(Number.isFinite(number) ? number : 0).toLocaleString('ru-RU').replaceAll('\u00a0', ' ')} ₽`;
}

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function requestProcedures(request = {}) {
  return Array.isArray(request.procedures) ? request.procedures : [];
}

function requestPricing(request = {}) {
  const finance = request.finance && typeof request.finance === 'object' ? request.finance : {};
  return {
    subtotal: Math.max(0, Number(finance.serviceTotal || 0)),
    discountAmount: Math.max(0, Number(finance.discountTotal || 0)),
    total: Math.max(0, Number(finance.planTotal || 0)),
  };
}

function requestPayment(request = {}) {
  const payment = request.payment && typeof request.payment === 'object' ? request.payment : {};
  return {
    state: String(payment.state || 'unpaid'),
    paid: Math.max(0, Number(payment.paid || 0)),
    due: Math.max(0, Number(payment.due || 0)),
  };
}

const ACTION_STATUS_LABELS = Object.freeze({
  booked: 'Записался',
  rescheduled: 'Перенёс',
  cancelled: 'Отменил',
});

const PAYMENT_STATUS_LABELS = Object.freeze({
  due: 'К оплате',
  paid: 'Оплачено',
  debt: 'Задолженность',
});

function requestStatuses(request = {}) {
  return projectRecordStatuses(request, request.history, requestPayment(request));
}

function contactWorkplaceCard(relationship, workplace, { interactive = true } = {}) {
  const profile = relationshipProfile(relationship);
  const supplied = {
    appearance: workplace?.cardAppearance,
    fields: workplaceCardFields(workplace, profile),
    image: String(workplace?.photo || ''),
    imagePosition: `${Number(workplace?.photoCropX ?? 50)}% ${Number(workplace?.photoCropY ?? 50)}%`,
  };
  const view = professionalContactCard(workplace?.card, supplied) || {
    ...supplied,
    appearance: workplaceCardAppearance(workplace),
  };
  return entityVisualCard({
    ...view,
    interactive,
    data: interactive ? `data-global-contact-workplace="${escapeHtml(String(workplace?.key || ''))}"` : '',
    aria: interactive ? `Открыть ${String(workplace?.name || 'пространство')}` : String(workplace?.name || 'Пространство'),
  });
}

const CONTACT_PROGRAM_CARD_APPEARANCE = normalizeEntityCardAppearance({
  lines: [
    { field: 'title', zone: 'full', align: 'left', size: 'm', color: 'white', bold: true },
    {}, {}, {}, {}, {},
    { field: 'balance', zone: 'full', align: 'left', size: 'l', color: 'white', bold: true },
    { field: 'meta', zone: 'full', align: 'left', size: 's', color: 'white' },
    {},
  ],
});

function contactProgramCard(program = {}) {
  const personal = String(program.type || '') === 'personal-account';
  const title = String(program.title || (personal ? 'Личный счёт' : 'Программа'));
  const meta = personal && Number(program.debtTotal || 0) > 0.009
    ? `Задолженность ${money(program.debtTotal)}`
    : personal ? 'Программа' : String(program.status || '');
  const fallback = {
    appearance: CONTACT_PROGRAM_CARD_APPEARANCE,
    fields: [
      { value: 'title', label: 'Программа', text: title },
      { value: 'balance', label: 'Остаток', text: money(program.balance) },
      { value: 'meta', label: 'Состояние', text: meta },
    ],
    image: '',
    imagePosition: '50% 50%',
  };
  // Use only the already-public program fields when Core supplies an empty
  // projection. Nonempty Professional projections remain untouched.
  const view = professionalContactCard(program.card, { fields: fallback.fields }) || fallback;
  return entityVisualCard({
    ...view,
    interactive: true,
    data: personal
      ? 'data-global-contact-personal-account'
      : `data-global-contact-deposit="${escapeHtml(String(program.depositId || ''))}"`,
    aria: `Открыть ${title}`,
  });
}

function programWorkplaceKeys(program = {}) {
  const direct = [program.workplaceKey, program.workplaceId, program.spaceKey, program.spaceId];
  const grouped = [program.workplaceKeys, program.workplaceIds, program.spaceKeys, program.spaceIds]
    .flatMap((value) => Array.isArray(value) ? value : []);
  return [...new Set([...direct, ...grouped].map((value) => String(value || '').trim()).filter(Boolean))];
}

function programBelongsToWorkplace(program, workplaceKey) {
  const key = String(workplaceKey || '').trim();
  return Boolean(key && programWorkplaceKeys(program).includes(key));
}

function contactProfessionalPrograms(programs = []) {
  return (Array.isArray(programs) ? programs : []).filter((program) => programWorkplaceKeys(program).length === 0);
}

function contactWorkplacePrograms(programs = [], workplaceKey = '') {
  return (Array.isArray(programs) ? programs : []).filter((program) => programBelongsToWorkplace(program, workplaceKey));
}

function requestTimestamp(request = {}) {
  const date = String(request?.date || '').slice(0, 10);
  if (!date) return Number.NaN;
  const from = String(request?.from || '00:00').slice(0, 5) || '00:00';
  const value = new Date(`${date}T${from}:00`).getTime();
  return Number.isFinite(value) ? value : Number.NaN;
}

function preferredHistoryIndex(records = []) {
  const now = Date.now();
  let upcomingIndex = -1;
  let upcomingTime = Number.POSITIVE_INFINITY;
  let previousIndex = -1;
  let previousTime = Number.NEGATIVE_INFINITY;

  records.forEach((request, index) => {
    if (requestStatuses(request).action === 'cancelled') return;
    const timestamp = requestTimestamp(request);
    if (!Number.isFinite(timestamp)) return;
    if (timestamp >= now && timestamp < upcomingTime) {
      upcomingTime = timestamp;
      upcomingIndex = index;
    } else if (timestamp < now && timestamp > previousTime) {
      previousTime = timestamp;
      previousIndex = index;
    }
  });

  if (upcomingIndex >= 0) return upcomingIndex;
  if (previousIndex >= 0) return previousIndex;
  return records.length ? 0 : -1;
}

function contactHistoryMiniCard(workplace, request, index, { canRepeat = false, current = false } = {}) {
  const pricing = requestPricing(request);
  return recordMiniCard({
    date: formatDate(request.date),
    from: request.from,
    procedures: requestProcedures(request).slice(0, 4),
    total: money(pricing.total || pricing.subtotal),
    compactAction: canRepeat ? {
      label: '↻',
      data: `data-global-contact-repeat="${index}"`,
      aria: 'Повторить запись',
    } : null,
    interactive: true,
    data: `data-global-contact-history="${index}"${current ? ' data-v2-rail-current' : ''}`,
    aria: `Открыть чек ${formatDate(request.date)}`,
  });
}

function contactReceiptBody(workplace, request) {
  const pricing = requestPricing(request);
  const payment = requestPayment(request);
  const statuses = requestStatuses(request);
  const totals = [
    { label: 'Стоимость', value: money(pricing.subtotal) },
    { label: 'Скидка', value: money(pricing.discountAmount) },
    { label: 'Оплачено', value: money(payment.paid), strong: true },
  ];
  if ((statuses.payment === 'due' || statuses.payment === 'debt') && payment.due > 0.009) {
    totals.push({ label: PAYMENT_STATUS_LABELS[statuses.payment] || 'К оплате', value: money(payment.due), strong: true });
  }
  return readOnlyReceipt({
    title: String(workplace?.name || 'Пространство'),
    status: ACTION_STATUS_LABELS[statuses.action] || '',
    date: formatDate(request.date),
    time: request.from || '',
    items: requestProcedures(request).map((item) => ({
      label: item?.name || 'Процедура',
      value: money(item?.cost || item?.price || 0),
    })),
    totals,
  });
}

async function openGlobalContactRecordQ(relationship, workplace, request) {
  const tenantId = String(relationship?.tenantId || '');
  const recordId = String(request?.id || '');
  if (!tenantId || !recordId) return null;
  const layer = mountModal(document.body, modal('<div data-contact-record-q><div class="muted">Загрузка…</div></div>', {
    variant: 'q',
    title: String(workplace?.name || 'Чек'),
  }));
  const host = layer?.querySelector('[data-contact-record-q]');
  try {
    const detail = await getGlobalContactRecord(tenantId, recordId);
    if (host) host.innerHTML = contactReceiptBody(workplace, detail);
  } catch (error) {
    if (host) host.innerHTML = emptyState('Чек не открыт', accountErrorMessage(error, 'Не удалось открыть чек'));
  }
  return layer;
}

async function openGlobalContactWorkplaceQ(relationship, workplace, handlers) {
  const tenantId = String(relationship?.tenantId || '');
  const workplaceKey = String(workplace?.key || '');
  if (!tenantId || !workplaceKey) return null;
  const layer = mountModal(document.body, modal('<div data-contact-workplace-q><div class="muted">Загрузка…</div></div>', {
    variant: 'q',
    title: String(workplace?.name || 'Пространство'),
  }));
  const host = layer?.querySelector('[data-contact-workplace-q]');
  try {
    const [rows, recordAllowed] = await Promise.all([
      getGlobalContactWorkplaceHistory(tenantId, workplaceKey),
      getContactRecordAllowed(tenantId),
    ]);
    const records = Array.isArray(rows) ? rows : [];
    const canRecord = recordAllowed === true;
    const currentIndex = preferredHistoryIndex(records);
    const scopedPrograms = contactWorkplacePrograms(relationship?.programs, workplaceKey);
    if (host) {
      const history = records.length
        ? miniCardRail(
          records.map((request, index) => contactHistoryMiniCard(workplace, request, index, {
            canRepeat: canRecord,
            current: index === currentIndex,
          })),
          { affordanceMinItems: 3 },
        )
        : emptyState('История пока пустая', 'Обслуживание в этом пространстве появится здесь.');
      const programRail = scopedPrograms.length
        ? v2Section('Программы', entityCardRail(scopedPrograms.map(contactProgramCard)))
        : '';
      const recordAction = canRecord
        ? `<div class="modal-actions">${button('Записаться', { data: 'data-contact-workplace-record' })}</div>`
        : '';
      host.innerHTML = `${v2Section('История', history)}${programRail}${recordAction}`;
      host.querySelector('[data-contact-workplace-record]')?.addEventListener('click', () => {
        layer.v2Close?.();
        handlers?.onStartRecord?.(tenantId, { workplaceKey });
      });
      host.querySelectorAll('[data-global-contact-history]').forEach((node) => node.addEventListener('click', () => {
        const request = records[Number(node.dataset.globalContactHistory)];
        if (request) void openGlobalContactRecordQ(relationship, workplace, request);
      }));
      host.querySelectorAll('[data-global-contact-repeat]').forEach((node) => node.addEventListener('click', () => {
        const request = records[Number(node.dataset.globalContactRepeat)];
        if (!request) return;
        layer.v2Close?.();
        handlers?.onStartRecord?.(tenantId, { workplaceKey, repeatRequest: request });
      }));
      host.querySelector('[data-global-contact-personal-account]')?.addEventListener('click', () => {
        void openGlobalContactPersonalAccountQ(relationship);
      });
      host.querySelectorAll('[data-global-contact-deposit]').forEach((node) => node.addEventListener('click', () => {
        const program = scopedPrograms.find((item) => String(item?.depositId || '') === String(node.dataset.globalContactDeposit || ''));
        if (program) void openGlobalContactDepositQ(relationship, program);
      }));
    }
  } catch (error) {
    if (host) host.innerHTML = emptyState('Пространство не открыто', accountErrorMessage(error, 'Не удалось загрузить данные пространства'));
  }
  return layer;
}

function contactPersonalAccountHistory(account = {}) {
  const labels = {
    funding: 'Пополнение',
    withdrawal: 'Возврат',
    payment: 'Оплата',
    'payment-refund': 'Возврат оплаты',
    refund: 'Возврат оплаты',
  };
  const rows = (Array.isArray(account.movements) ? account.movements : []).map((movement) => v2ListEntry({
    title: labels[String(movement?.kind || '')] || 'Операция',
    subtitle: shortDateTime(movement?.occurredAt, '—'),
    rightTop: `${String(movement?.direction || '').toUpperCase() === 'IN' ? '+' : '−'}${money(movement?.amount)}`,
    rightBottom: `Остаток ${money(movement?.balanceAfter)}`,
  }));
  return rows.length ? v2ListEntries(rows) : emptyState('Истории пока нет', 'Движения Личного счёта появятся здесь.');
}

async function openGlobalContactPersonalAccountQ(relationship) {
  const tenantId = String(relationship?.tenantId || '');
  if (!tenantId) return null;
  const layer = mountModal(document.body, modal('<div data-contact-personal-account-q><div class="muted">Загрузка…</div></div>', {
    variant: 'q',
    title: 'Личный счёт',
  }));
  const host = layer?.querySelector('[data-contact-personal-account-q]');
  try {
    const account = await getGlobalContactPersonalAccount(tenantId);
    const debts = (Array.isArray(account?.debts) ? account.debts : []).map((debt) => {
      const open = String(debt?.status || '') !== 'closed' && Number(debt?.outstandingAmount || 0) > 0.009;
      return v2ListEntry({
        title: open ? 'Задолженность' : 'Задолженность погашена',
        subtitle: shortDateTime(debt?.occurredAt, '—'),
        rightTop: money(open ? debt?.outstandingAmount : debt?.originalAmount),
        rightBottom: open ? 'К оплате' : 'Погашено',
      });
    });
    if (host) host.innerHTML = page([
      details([
        { label: 'Личный счёт', value: money(account?.balance) },
        { label: 'Задолженность', value: money(account?.debtTotal) },
        { label: 'Оплата Личным счётом', value: Number(account?.spendLimitPercent ?? 100) >= 100 ? 'Без ограничений' : `До ${Number(account?.spendLimitPercent || 0)}%` },
      ]),
      v2Section('История', contactPersonalAccountHistory(account)),
      debts.length ? v2Section('Задолженность', v2ListEntries(debts)) : '',
    ]);
  } catch (error) {
    if (host) host.innerHTML = emptyState('Личный счёт не открыт', accountErrorMessage(error, 'Не удалось открыть Личный счёт'));
  }
  return layer;
}

function depositStatus(status = '') {
  if (status === 'expired') return 'Срок завершён';
  if (status === 'closed') return 'Закрыт';
  return 'Активен';
}

// Display the existing Core deposit contract; never calculate or persist a
// second discount in User. An expired deposit keeps its historical terms,
// while the current discount is taken only from Core's discountPercent.
function contactDepositDetails(deposit = {}, fallbackTitle = 'Депозит') {
  const terms = deposit?.terms && typeof deposit.terms === 'object' ? deposit.terms : {};
  const benefitMode = String(deposit?.benefitMode || terms.benefitType || '').trim();
  const discountPercent = Math.max(0, Number(deposit?.discountPercent || 0));
  const benefitValue = Number(terms.benefitValue || 0);
  const storedBenefit = String(terms.benefit || '').trim();
  const benefitText = storedBenefit || (
    benefitMode === 'discount' && benefitValue > 0 ? `На обслуживание ${benefitValue}%`
      : benefitMode === 'accrual' && benefitValue > 0 ? `Начисление ${benefitValue}%`
        : 'Без дополнительной выгоды'
  );
  const termText = String(terms.termRule || 'Бессрочно')
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, year, month, day) => `${day}.${month}.${year.slice(-2)}`);
  const description = String(terms.description || '').trim();
  return [
    { label: 'Депозит', value: String(deposit?.programName || fallbackTitle) },
    ...(deposit?.fundedAt ? [{ label: 'Дата оформления', value: shortDateTime(deposit.fundedAt, '—') }] : []),
    { label: 'Остаток', value: money(deposit?.balance) },
    { label: 'Внесено', value: money(deposit?.fundedAmount) },
    { label: 'Срок', value: termText },
    { label: 'Условие выгоды', value: benefitText },
    ...(benefitMode === 'discount' && discountPercent > 0
      ? [{ label: 'Действующая скидка', value: `${discountPercent}%` }]
      : []),
    ...(description ? [{ label: 'Условия программы', value: description }] : []),
    { label: 'Состояние', value: depositStatus(String(deposit?.status || '')) },
  ];
}

function contactDepositHistory(deposit = {}) {
  const labels = {
    'deposit-funding': 'Внесение',
    'deposit-benefit': 'Выгода',
    'deposit-benefit-reversal': 'Отмена выгоды',
    'deposit-withdrawal': 'Возврат остатка',
    payment: 'Использование при оплате',
    refund: 'Возврат оплаты',
  };
  const rows = (Array.isArray(deposit.history) ? deposit.history : [])
    .slice()
    .sort((a, b) => String(b?.occurredAt || '').localeCompare(String(a?.occurredAt || '')))
    .map((movement) => v2ListEntry({
      title: labels[String(movement?.kind || '')] || 'Операция',
      subtitle: shortDateTime(movement?.occurredAt, '—'),
      rightTop: `${String(movement?.direction || '').toUpperCase() === 'IN' ? '+' : '−'}${money(movement?.amount)}`,
    }));
  return rows.length ? v2ListEntries(rows) : emptyState('Истории пока нет', 'Движения программы появятся здесь.');
}

async function openGlobalContactDepositQ(relationship, program) {
  const tenantId = String(relationship?.tenantId || '');
  const depositId = String(program?.depositId || '');
  if (!tenantId || !depositId) return null;
  const title = String(program?.title || 'Депозит');
  const layer = mountModal(document.body, modal('<div data-contact-deposit-q><div class="muted">Загрузка…</div></div>', {
    variant: 'q',
    title,
  }));
  const host = layer?.querySelector('[data-contact-deposit-q]');
  try {
    const deposit = await getGlobalContactDeposit(tenantId, depositId);
    if (host) host.innerHTML = page([
      details(contactDepositDetails(deposit, title)),
      v2Section('История', contactDepositHistory(deposit)),
    ]);
  } catch (error) {
    if (host) host.innerHTML = emptyState('Программа не открыта', accountErrorMessage(error, 'Не удалось открыть программу'));
  }
  return layer;
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

function openGlobalContactSettings(state, handlers, relationship, detailLayer) {
  const tenantId = String(relationship?.tenantId || '');
  if (!tenantId) return null;
  return openSharedProfileSettingsMenu({
    title: 'Настройки',
    actions: [
      { id: 'consents', label: 'Согласия', onSelect: () => void openContactConsentQ(state, handlers, relationship, detailLayer) },
      { id: 'delete', label: 'Удалить', variant: 'critical', onSelect: () => confirmDeleteGlobalContact(state, handlers, relationship) },
    ],
    data: 'data-global-contact-settings-menu',
  });
}

function setContactHeader(root, relationship) {
  const current = root.querySelector('[data-v2-header]');
  if (!current) return;
  const profile = relationshipProfile(relationship);
  const title = relationshipTitle(relationship);
  current.outerHTML = v2Header({
    a: {
      kind: 'avatar',
      label: title,
      image: profile.photo,
      imagePosition: `${Number(profile.photoCropX || 50)}% ${Number(profile.photoCropY || 50)}%`,
    },
    b: {
      label: title,
      subtitle: profile.profession,
    },
  });
}

function restoreContactsHeader(root, state) {
  const current = root.querySelector('[data-v2-header]');
  if (!current) return;
  current.outerHTML = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state) },
    b: 'Контакты',
  });
}

async function openGlobalContactDetailZ(root, state, handlers) {
  let relationship = selectedGlobalRelationship(state);
  if (!relationship) return null;

  // Open the approved Shared Z immediately. The remote contact payload must
  // not block tapping the card; its contents appear on the same Z once ready.
  const title = relationshipTitle(relationship);
  const layer = mountV2ZLayer(root, v2ZLayer(
    '<div data-contact-detail-content><div class="muted">Загрузка…</div></div>',
    { className: 'account-contact-detail-z' },
  ), {
    stack: false,
    dismissible: true,
    onClose: () => {
      state.accountSelectedContactTenantId = '';
      restoreContactsHeader(root, state);
      bindGlobalContactsV(root, state, handlers);
    },
  });
  if (!layer) return null;
  layer.setAttribute('aria-label', title);
  setContactHeader(root, relationship);

  try {
    relationship = await loadGlobalContactDetail(state, relationship);
  } catch (error) {
    if (!layer.isConnected) return layer;
    layer.v2Close?.();
    openNotice({
      title: 'Контакт не открыт',
      message: accountErrorMessage(error, 'Не удалось загрузить данные контакта'),
      action: 'Закрыть',
      variant: 'technical',
    });
    return null;
  }
  if (!layer.isConnected) return layer;

  const tenantId = String(relationship?.tenantId || '').trim();
  const workplaces = Array.isArray(relationship?.workplaces) ? relationship.workplaces : [];
  const allPrograms = Array.isArray(relationship?.programs) ? relationship.programs : [];
  const programs = contactProfessionalPrograms(allPrograms);
  const workplaceRail = workplaces.length
    ? v2Section('Пространства', entityCardRail(workplaces.map((workplace) => contactWorkplaceCard(relationship, workplace))))
    : '';
  const programRail = programs.length
    ? v2Section('Программы', entityCardRail(programs.map(contactProgramCard)))
    : '';
  const relationshipBody = [workplaceRail, programRail].filter(Boolean).join('')
    || emptyState('Пока пусто', 'Данные взаимодействия появятся здесь.');
  const host = layer.querySelector('[data-contact-detail-content]');
  if (!host) return layer;
  host.innerHTML = `<div data-global-contact-record-action></div>${relationshipBody}`;
  layer.setAttribute('aria-label', relationshipTitle(relationship));
  setContactHeader(root, relationship);

  const contactV = setV2V(root, { data: 'data-global-contact-settings', aria: 'Настройки контакта' });
  contactV?.addEventListener('click', () => openGlobalContactSettings(state, handlers, relationship, layer));

  layer.querySelectorAll('[data-global-contact-workplace]').forEach((node) => node.addEventListener('click', () => {
    const workplace = workplaces.find((item) => String(item?.key || '') === String(node.dataset.globalContactWorkplace || ''));
    if (workplace) void openGlobalContactWorkplaceQ(relationship, workplace, handlers);
  }));
  layer.querySelector('[data-global-contact-personal-account]')?.addEventListener('click', () => {
    void openGlobalContactPersonalAccountQ(relationship);
  });
  layer.querySelectorAll('[data-global-contact-deposit]').forEach((node) => node.addEventListener('click', () => {
    const program = programs.find((item) => String(item?.depositId || '') === String(node.dataset.globalContactDeposit || ''));
    if (program) void openGlobalContactDepositQ(relationship, program);
  });

  const recordAllowed = await getContactRecordAllowed(tenantId);
  if (!layer.isConnected) return layer;
  if (recordAllowed === true) {
    syncContactRecordAction(layer, tenantId, handlers, true);
  } else if (recordAllowed === false) {
    await openContactConsentQ(state, handlers, relationship, layer);
  }
  return layer;
}
async function renderGlobalContactDetail(root, state, handlers) {
  state.accountTab = 'contacts';
  state.accountDeckActive = 'contacts';
  await renderGlobalContacts(root, state, handlers);
  return openGlobalContactDetailZ(root, state, handlers);
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
