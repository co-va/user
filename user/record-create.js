import {
  createContactRecord,
  getContactRecordContext,
  getRecordContacts,
} from '../core/record/platform-api.js';
import {
  getRecordProcedures,
  getRecordSlots,
  getRecordTimeRows,
  getRecordWorkingDates,
  recordProcedureCost,
  recordProcedurePriceText,
  recordSelectionQuote,
} from '../core/record/availability.js';
import {
  escapeHtml,
  field,
  openNotice,
  openRecordCreationOwner,
  recordMiniCard,
  durationText,
  recordContactList,
  v2ListEntry,
  v2ListEntries,
} from '../ui/user-ui.js';
import { openRecords } from './record-flow.js';

let activeOwner = null;
let opening = false;

function text(value) {
  return String(value ?? '').trim();
}

function money(value) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value) || 0)} ₽`;
}

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function contactProfile(target = {}) {
  const context = target?.context && typeof target.context === 'object' ? target.context : {};
  return context?.profile && typeof context.profile === 'object' ? context.profile : {};
}

function contactTitle(target = {}) {
  const profile = contactProfile(target);
  return [profile.name, profile.surname].filter(Boolean).join(' ').trim() || 'Контакт';
}

function contactSearchText(target = {}) {
  const profile = contactProfile(target);
  return [contactTitle(target), profile.profession, profile.phone]
    .map((value) => text(value).toLocaleLowerCase('ru'))
    .filter(Boolean)
    .join(' ');
}

function contactList(targets = [], query = '') {
  const needle = text(query).toLocaleLowerCase('ru');
  const filtered = (Array.isArray(targets) ? targets : [])
    .filter((target) => text(target?.tenantId))
    .filter((target) => !needle || contactSearchText(target).includes(needle));

  return recordContactList(filtered.map((target) => {
    const profile = contactProfile(target);
    const title = contactTitle(target);
    return {
      key: text(target.tenantId),
      name: title,
      overline: text(profile.profession),
      phone: text(profile.phone),
      aria: `Выбрать специалиста ${title}`,
    };
  }), {
    data: 'data-user-record-contact',
    empty: needle ? 'Специалист не найден.' : 'Контактов пока нет.',
  });
}

function workplaceRows(context = {}, workplaces = []) {
  return v2ListEntries(workplaces.map((workplace) => {
    const workplaceKey = text(workplace?.key);
    const available = getRecordWorkingDates(context, workplaceKey).length > 0;
    return v2ListEntry({
      title: text(workplace?.name) || 'Рабочее пространство',
      subtitle: [workplace?.city, workplace?.address].map(text).filter(Boolean).join(', '),
      interactive: available,
      data: available ? `data-user-record-workplace="${escapeHtml(workplaceKey)}"` : '',
      aria: available ? `Выбрать рабочее пространство ${text(workplace?.name)}` : '',
    });
  }));
}

function procedureEntry(procedure, workplaceKey) {
  return {
    id: text(procedure?.id),
    name: text(procedure?.name),
    cost: recordProcedureCost(procedure, workplaceKey),
    priceText: recordProcedurePriceText(procedure, workplaceKey),
    duration: Math.max(0, Number(procedure?.duration) || 0),
    raw: procedure,
  };
}

function summaryMarkup(state = {}, workplaceKey = '', context = {}) {
  const workplace = (Array.isArray(context?.workplaces) ? context.workplaces : [])
    .find((item) => text(item?.key) === text(workplaceKey));
  // No price or duration calculations on the confirmation surface.
  // Both values were prepared once when the selected procedures changed.
  const quote = state.quote || {};
  return `<div class="record-confirmation-view__card">${recordMiniCard({
    confirmation: true,
    workplace: text(workplace?.name) || 'Рабочее пространство',
    date: formatDate(state.date),
    from: text(state.from),
    procedures: state.procedures,
    duration: durationText(quote.durationMinutes),
    total: text(quote.totalText),
  })}</div>`;
}

function reopenWorkplaceOrigin(workplaceKey) {
  const key = text(workplaceKey);
  if (!key) return false;
  const node = [...document.querySelectorAll('[data-global-contact-workplace]')]
    .find((item) => text(item?.dataset?.globalContactWorkplace) === key);
  if (!node) return false;
  node.click();
  return true;
}

async function startUserRecord(contactId, owner, options = {}) {
  const id = text(contactId);
  if (!id || !owner?.isOpen?.()) return;

  const contextResult = await getContactRecordContext(id)
    .then((value) => ({ value }))
    .catch((error) => ({ error }));
  if (!owner.isOpen()) return;
  if (contextResult?.error) {
    openNotice({ title: 'Запись недоступна', message: 'Не удалось получить данные для записи.' });
    return;
  }

  let recordContext = contextResult?.value && typeof contextResult.value === 'object' ? contextResult.value : {};
  const workplaces = Array.isArray(recordContext.workplaces) ? recordContext.workplaces : [];
  if (!workplaces.length) {
    openNotice({ title: 'Запись недоступна', message: 'Рабочие пространства не настроены.' });
    return;
  }

  const slotStep = Math.max(0, Number(recordContext?.slotStep) || 0);
  const repeatRequest = options?.repeatRequest && typeof options.repeatRequest === 'object' ? options.repeatRequest : null;
  const requestedWorkplace = text(options?.workplaceKey || repeatRequest?.workplaceId || repeatRequest?.workplaceKey);
  const explicitWorkplaceEntry = Boolean(text(options?.workplaceKey) || repeatRequest);
  const returnToContactSelector = typeof options?.onBackToContactSelector === 'function'
    ? options.onBackToContactSelector
    : null;
  let activeWorkplaceKey = '';

  const ownerRender = owner.__userRecordBaseRender || owner.render.bind(owner);
  owner.__userRecordBaseRender = ownerRender;
  owner.render = (config = {}) => {
    const confirmation = config?.step === 'confirmation' && text(config?.action?.data).includes('data-records-confirm');
    if (!confirmation) return ownerRender(config);
    const state = owner.getRecordState?.() || {};
    return ownerRender({ ...config, title: false, body: summaryMarkup(state, activeWorkplaceKey, recordContext) });
  };

  const provider = {
    procedures: (workplaceKey) => getRecordProcedures(recordContext, workplaceKey),
    procedureId: (procedure) => text(procedure?.id),
    procedureName: (procedure) => text(procedure?.name),
    procedureCost: (procedure, workplaceKey) => recordProcedureCost(procedure, workplaceKey),
    procedurePriceText: (procedure, workplaceKey) => recordProcedurePriceText(procedure, workplaceKey),
    quote: (procedures, workplaceKey) => recordSelectionQuote(procedures, workplaceKey),
    procedureDuration: (procedure) => Math.max(0, Number(procedure?.duration) || 0),
    workingDates: (workplaceKey) => getRecordWorkingDates(recordContext, workplaceKey),
    timeRows: ({ workplaceId, date, procedures }) => getRecordTimeRows(recordContext, {
      workplaceKey: workplaceId,
      date,
      duration: procedures.reduce((sum, item) => sum + Math.max(0, Number(item?.duration) || 0), 0),
      step: slotStep,
    }),
    async create(state) {
      return createContactRecord(id, {
        workplaceKey: state.workplaceId,
        date: state.date,
        from: state.from,
        procedureIds: state.procedures.map((item) => text(item?.id)).filter(Boolean),
      });
    },
    async onCreateError(error, state, { renderTimes, renderConfirmation }) {
      recordContext = await getContactRecordContext(id, state.workplaceId).catch(() => recordContext);
      const duration = state.procedures.reduce((sum, item) => sum + Math.max(0, Number(item?.duration) || 0), 0);
      const stillAvailable = getRecordSlots(recordContext, {
        workplaceKey: state.workplaceId,
        date: state.date,
        duration,
        step: slotStep,
      }).some((slot) => text(slot.from) === text(state.from));
      if (!stillAvailable) {
        openNotice({ title: 'Запись недоступна', message: 'Выбранное время уже занято. Выберите другое.' });
        renderTimes();
        return;
      }
      openNotice({ title: 'Не удалось подтвердить запись', message: text(error?.message) || 'Повторите попытку.' });
      renderConfirmation();
    },
  };

  const returnToOrigin = () => {
    if (returnToContactSelector) return returnToContactSelector() !== false;
    owner.close?.();
    if (explicitWorkplaceEntry && requestedWorkplace) {
      queueMicrotask(() => reopenWorkplaceOrigin(requestedWorkplace));
    }
    return true;
  };

  const openFlow = (workplaceKey, procedures = [], { backToWorkplaces = false } = {}) => {
    activeWorkplaceKey = text(workplaceKey);
    openRecords({
      workplaceId: activeWorkplaceKey,
      procedures,
      provider,
      creationOwner: owner,
      stepBack: true,
      onBackFromStart: () => backToWorkplaces ? renderWorkplaces() : returnToOrigin(),
      onCreated: (result) => {
        window.dispatchEvent(new CustomEvent('cova:user-record-created', { detail: result || {} }));
      },
    });
  };

  const renderWorkplaces = () => {
    if (!owner.isOpen()) return false;
    owner.setBackHandler?.(() => {
      if (returnToContactSelector) return returnToContactSelector() !== false;
      owner.close?.();
      return true;
    });
    const view = owner.render({
      step: 'workplace',
      body: workplaceRows(recordContext, workplaces),
    });
    view?.body?.querySelectorAll('[data-user-record-workplace]').forEach((node) => node.addEventListener('click', () => {
      const workplaceKey = text(node.dataset.userRecordWorkplace);
      if (workplaceKey) openFlow(workplaceKey, [], { backToWorkplaces: true });
    }));
    return true;
  };

  if (repeatRequest) {
    const workplaceKey = requestedWorkplace;
    const procedureIds = new Set((Array.isArray(repeatRequest.procedures) ? repeatRequest.procedures : [])
      .map((item) => text(item?.id)).filter(Boolean));
    const available = getRecordProcedures(recordContext, workplaceKey);
    const procedures = available.filter((item) => procedureIds.has(text(item?.id))).map((item) => procedureEntry(item, workplaceKey));
    if (!workplaceKey || !workplaces.some((item) => text(item?.key) === workplaceKey) || !procedures.length) {
      openNotice({ title: 'Повтор записи', message: 'Предыдущие параметры записи больше недоступны.' });
      return;
    }
    openFlow(workplaceKey, procedures);
    return;
  }

  if (requestedWorkplace && workplaces.some((item) => text(item?.key) === requestedWorkplace)) {
    openFlow(requestedWorkplace);
    return;
  }
  if (workplaces.length === 1) {
    openFlow(text(workplaces[0]?.key));
    return;
  }
  renderWorkplaces();
}

export async function openUserRecordContactSelector(existingOwner = null) {
  const owner = existingOwner || openRecordCreationOwner();
  if (!owner) return null;
  owner.setBackHandler?.(null);

  const view = owner.render({
    step: 'contact',
    title: 'Выбор специалиста',
    header: field({
      name: 'userRecordContactSearch',
      type: 'search',
      placeholder: 'Телефон, имя или профессия',
      autocomplete: 'off',
      data: 'data-user-record-contact-search',
    }),
    body: '<div class="record-screen record-screen--people"><div class="record-contact-list" data-user-record-contact-list><div class="muted">Загрузка…</div></div></div>',
  });
  const listHost = view?.body?.querySelector('[data-user-record-contact-list]');
  const search = view?.header?.querySelector('[data-user-record-contact-search]');
  if (!listHost) return owner;

  let contacts = [];
  let openingContact = false;
  const renderList = () => {
    listHost.innerHTML = contactList(contacts, search?.value || '');
    listHost.querySelectorAll('[data-user-record-contact]').forEach((node) => node.addEventListener('click', () => {
      if (openingContact) return;
      const contactId = text(node.dataset.userRecordContact);
      if (!contactId) return;
      openingContact = true;
      void startUserRecord(contactId, owner, {
        onBackToContactSelector: () => {
          void openUserRecordContactSelector(owner);
          return true;
        },
      }).finally(() => { openingContact = false; });
    }));
  };
  search?.addEventListener('input', renderList);

  try {
    contacts = await getRecordContacts();
    if (owner.isOpen()) renderList();
  } catch {
    if (owner.isOpen()) listHost.innerHTML = '<div class="muted">Не удалось загрузить контакты.</div>';
  }
  return owner;
}

function startFromEvent(event) {
  const detail = event?.detail && typeof event.detail === 'object' ? event.detail : {};
  const contactId = text(detail.contactId);
  if (!contactId || opening || activeOwner?.isOpen?.()) return;
  const owner = openRecordCreationOwner();
  if (!owner) return;
  activeOwner = owner;
  opening = true;
  void startUserRecord(contactId, owner, {
    workplaceKey: text(detail.workplaceKey),
    repeatRequest: detail.repeatRequest && typeof detail.repeatRequest === 'object' ? detail.repeatRequest : null,
  }).finally(() => {
    opening = false;
    if (!owner.isOpen?.()) activeOwner = null;
  });
}

window.addEventListener('cova:user-record-open-contacts', () => {
  void openUserRecordContactSelector();
});
window.addEventListener('cova:user-record-start', startFromEvent);
