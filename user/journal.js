import {
  button,
  emptyState,
  escapeHtml,
  initCalendar,
  initDateNavigator,
  initJournalDayTimeline,
  initViewNavigation,
  journalDayTimeline,
  modal,
  mountModal,
  openRecordCreationOwner,
  shortDate,
  v2ListEntries,
  v2ListEntry,
  viewNavigation,
} from '../ui/user-ui.js';
import { clearV2Y, setV2Y } from '../ui/v2/index.js';
import { clearV2ZHeaderRows, setV2ZHeaderRows } from '../ui/v2/z-layout.js';
import { readOnlyReceipt } from '../ui/receipt/index.js';
import { initNoteReels, noteReels } from '../ui/note/index.js';
import {
  isRecordCompletedSide,
  recordActivityTime,
  recordAppointmentTime,
  recordVisualState,
} from '../core/record/state.js';
import {
  accountEventActions,
  accountEventsLoaded,
  getAccountEvent,
  getAccountEvents,
  loadAccountEvents,
} from '../core/event/account-owner.js';
import {
  accountNoteActions,
  accountNotesLoaded,
  getAccountNote,
  getAccountNotesForDay,
  loadAccountNotes,
} from '../core/note/account-owner.js';
import { syncAccountCalendars } from '../core/calendar-sync/account.js';
import { createUserEventFlow } from './event-create.js';
import { openUserEventView } from './event-view.js';
import { createUserNoteFlow } from './note-create.js';
import { openUserNoteView } from './note-view.js';
import { noteTargetLabel } from './note-target.js';

const VIEWS = [
  { id: 'day', label: 'День' },
  { id: 'month', label: 'Месяц' },
  { id: 'list', label: 'Список' },
];
const LIST_MODES = [
  { id: 'flow', label: 'Поток' },
  { id: 'time', label: 'По времени' },
];
const JOURNAL_DAY_FROM = '09:00';
const JOURNAL_DAY_TO = '23:00';
const RECORD_COLOR = '#EFFFBB';
const PAID_COLOR = '#DDE8D7';
const NO_SHOW_COLOR = '#F1DADA';
const EVENT_DEFAULT_COLOR = '#777A7D';

function dateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currentTimeForDay(day) {
  const now = new Date();
  if (dateKey(now) !== String(day || '').slice(0, 10)) return '';
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function money(value) {
  const number = Math.max(0, Number(value) || 0);
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(number).replaceAll('\u00a0', ' ')} ₽`;
}

function readRecords(source) {
  const value = typeof source === 'function' ? source() : source;
  return Array.isArray(value) ? value : [];
}

function recordId(record = {}) {
  return String(record?.id || record?.sourceId || '');
}

function paymentFor(record = {}) {
  const payment = record?.payment && typeof record.payment === 'object' ? record.payment : {};
  const state = String(payment?.state || '').trim().toLowerCase();
  const due = Math.max(0, Number(payment?.due) || 0);
  const paidAmount = Math.max(0, Number(payment?.paid) || 0);
  const planTotal = Math.max(0, Number(record?.finance?.planTotal) || 0);
  const factTotal = Math.max(0, Number(record?.finance?.factTotal) || 0);
  const paid = state
    ? state === 'paid'
    : (due <= 0.009 && paidAmount > 0.009) || (planTotal > 0.009 && factTotal + 0.009 >= planTotal);
  return {
    paid,
    due,
    paidAmount,
    activity: paid ? { paidAt: payment?.paidAt || payment?.updatedAt || record?.updatedAt || record?.date || '' } : null,
  };
}

function amountDue(record = {}) {
  const planTotal = Number(record?.finance?.planTotal);
  if (Number.isFinite(planTotal)) return Math.max(0, planTotal);
  return [...(Array.isArray(record?.procedures) ? record.procedures : []), ...(Array.isArray(record?.products) ? record.products : [])]
    .reduce((sum, item) => sum + Math.max(0, Number(item?.cost ?? item?.price) || 0), 0);
}

function recordObject(...values) {
  return values.find((value) => value && typeof value === 'object' && !Array.isArray(value)) || {};
}

function presentationFor(record = {}) {
  const snapshot = recordObject(record?.snapshot);
  const professionalSource = recordObject(
    snapshot?.professional,
    record?.professionalSnapshot,
    record?.professional,
  );
  const workplaceSource = recordObject(
    snapshot?.workplace,
    record?.workplaceSnapshot,
    record?.workplace,
  );
  const professional = {
    ...professionalSource,
    name: String(professionalSource?.name || record?.professionalName || '').trim(),
    surname: String(professionalSource?.surname || record?.professionalSurname || '').trim(),
    phone: String(professionalSource?.phone || record?.professionalPhone || '').trim(),
    uei: String(professionalSource?.uei || record?.professionalUei || '').trim(),
  };
  const name = [professional.name, professional.surname].filter(Boolean).join(' ').trim()
    || String(record?.professionalLabel || '').trim()
    || 'Профессионал';
  const workplaceName = String(
    workplaceSource?.name
      || workplaceSource?.title
      || record?.workplaceName
      || record?.workplaceTitle
      || 'Рабочее пространство'
  ).trim();
  return {
    professional,
    workplace: workplaceSource,
    name,
    workplaceName,
  };
}

function procedureRows(record = {}) {
  return (Array.isArray(record?.procedures) ? record.procedures : []).map((item) => ({
    label: String(item?.name || 'Процедура'),
    value: money(item?.cost ?? item?.price),
  }));
}

function openUserRecord(record) {
  const presentation = presentationFor(record);
  const payment = paymentFor(record);
  const body = readOnlyReceipt({
    title: presentation.workplaceName,
    status: String(record?.status || '').toLowerCase() === 'cancelled' ? 'Отменено' : '',
    date: shortDate(record?.date, ''),
    time: String(record?.from || ''),
    items: procedureRows(record),
    totals: [
      { label: 'Стоимость', value: money(amountDue(record)) },
      payment.paidAmount > 0.009 ? { label: 'Оплачено', value: money(payment.paidAmount), strong: true } : null,
      !payment.paid && payment.due > 0.009 ? { label: 'К оплате', value: money(payment.due), strong: true } : null,
    ].filter(Boolean),
  });
  const actions = (Array.isArray(record?.procedures) && record.procedures.length && String(record?.tenantId || ''))
    ? `<div class="modal-actions">${button('Повторить', { data: 'data-user-record-repeat' })}</div>`
    : '';
  const layer = mountModal(document.body, modal(`${body}${actions}`, {
    variant: 'x',
    xRole: 'action',
    surface: 'app',
    title: presentation.name,
  }));
  layer?.querySelector('[data-user-record-repeat]')?.addEventListener('click', () => {
    layer.v2Close?.();
    window.dispatchEvent(new CustomEvent('cova:user-record-start', {
      detail: {
        professionalId: String(record?.tenantId || ''),
        workplaceKey: String(record?.workplaceId || record?.workplaceKey || ''),
        repeatRequest: record,
      },
    }));
  });
  return layer;
}

function recordUsage(record) {
  const presentation = presentationFor(record);
  const payment = paymentFor(record);
  return {
    ...record,
    type: 'record',
    sourceId: recordId(record),
    person: presentation.professional,
    paid: payment.paid,
    financialTotal: amountDue(record),
  };
}

function eventUsage(event = {}) {
  return {
    ...event,
    type: 'event',
    sourceId: String(event?.id || ''),
    rigidity: 'soft',
  };
}

function usageMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function withOverlaps(values = []) {
  const usages = values.map((usage) => ({ ...usage, overlap: false }));
  const intervals = usages.map((usage, index) => {
    const from = usageMinutes(usage?.from);
    const rawTo = usageMinutes(usage?.to);
    if (from == null || rawTo == null || rawTo === from) return null;
    return { index, from, to: rawTo > from ? rawTo : rawTo + 24 * 60 };
  }).filter(Boolean);
  for (let left = 0; left < intervals.length; left += 1) {
    for (let right = left + 1; right < intervals.length; right += 1) {
      const a = intervals[left], b = intervals[right];
      if (a.from < b.to && b.from < a.to) {
        usages[a.index].overlap = true;
        usages[b.index].overlap = true;
      }
    }
  }
  return usages;
}

function targetSourceFor(records) {
  const allRecords = readRecords(records);
  return {
    readRecord: (id) => {
      const record = allRecords.find((item) => recordId(item) === String(id || '')) || null;
      return record ? recordUsage(record) : null;
    },
    recordsForDay: (date) => allRecords
      .filter((record) => String(record?.date || '').slice(0, 10) === String(date || '').slice(0, 10))
      .map((record) => recordUsage(record)),
    readEvent: (id) => getAccountEvent(id),
    eventsForDay: (date) => getAccountEvents()
      .filter((event) => String(event?.date || '').slice(0, 10) === String(date || '').slice(0, 10))
      .map(eventUsage),
  };
}

function openDayAction({ root, day, from, targetSource, rerender }) {
  const layer = mountModal(document.body, modal(`<div class="modal-actions">
    ${button('Событие', { variant: 'secondary', data: 'data-user-day-event' })}
    ${button('Заметка', { variant: 'secondary', data: 'data-user-day-note' })}
    ${button('Записаться', { data: 'data-user-day-record' })}
  </div>`, {
    variant: 'x',
    xRole: 'action',
    surface: 'app',
    title: 'Действие',
  }));
  layer?.querySelector('[data-user-day-record]')?.addEventListener('click', () => {
    layer.v2Close?.();
    window.dispatchEvent(new CustomEvent('cova:user-record-open-professionals'));
  });
  layer?.querySelector('[data-user-day-event]')?.addEventListener('click', () => {
    layer.v2Close?.();
    const owner = openRecordCreationOwner({
      surfaceRoot: root.closest('[data-v2-z],[data-v2-z-layer]'),
      bodyRoot: root,
      onCancel: rerender,
    });
    if (!owner) return;
    owner.setShellHeader?.('<div class="record-creation-step-title">Событие</div>');
    createUserEventFlow({ owner, date: day, timeHint: from, eventActions: accountEventActions, onCreated: rerender });
  });
  layer?.querySelector('[data-user-day-note]')?.addEventListener('click', () => {
    layer.v2Close?.();
    const owner = openRecordCreationOwner({
      surfaceRoot: root.closest('[data-v2-z],[data-v2-z-layer]'),
      bodyRoot: root,
      onCancel: rerender,
    });
    if (!owner) return;
    owner.setShellHeader?.('<div class="record-creation-step-title">Заметка</div>');
    createUserNoteFlow({ owner, date: day, noteActions: accountNoteActions, targetSource, onCreated: rerender });
  });
}

function renderDay(root, { date, records, navigationRoot, onChange }) {
  root.innerHTML = '<div data-user-journal-day-content><div data-user-journal-timeline></div></div>';
  if (navigationRoot) initDateNavigator(navigationRoot, { date, onChange });
  const day = dateKey(date);
  let disposed = false;
  let clockTimer = null;
  const rerender = () => {
    if (disposed || !root.isConnected) return;
    if (root.querySelector('[data-record-creation-flow]')) return;
    dispose();
    renderDay(root, { date, records, navigationRoot, onChange });
  };
  const dispose = () => {
    disposed = true;
    if (clockTimer) clearTimeout(clockTimer);
    clockTimer = null;
    clearV2Y(root);
  };

  if (!accountEventsLoaded()) void loadAccountEvents().then(rerender).catch(() => {});
  if (!accountNotesLoaded()) void loadAccountNotes().then(rerender).catch(() => {});
  void syncAccountCalendars().then(async (result) => {
    if (disposed || Number(result?.synced || 0) <= 0) return;
    await loadAccountEvents({ force: true });
    rerender();
  }).catch(() => {});

  const visible = readRecords(records)
    .filter((record) => String(record?.date || '').slice(0, 10) === day)
    .filter((record) => String(record?.status || '').toLowerCase() !== 'cancelled');
  const events = getAccountEvents().filter((event) => String(event?.date || '').slice(0, 10) === day);
  const targetSource = targetSourceFor(records);
  const activeTime = currentTimeForDay(day);
  const notes = getAccountNotesForDay(day);
  const yRoot = setV2Y(root, noteReels(notes, {
    activeTime,
    targetLabel: (note) => noteTargetLabel(note, { source: targetSource }),
  }));
  if (yRoot && !yRoot.hidden) {
    initNoteReels(yRoot, {
      onOpen: ({ noteId }) => {
        const note = getAccountNote(noteId);
        if (!note) return;
        openUserNoteView(note, {
          noteActions: accountNoteActions,
          targetSource,
          onSaved: rerender,
          onDeleted: rerender,
        });
      },
    });
  }

  const usages = withOverlaps([
    ...visible.map((record) => recordUsage(record)),
    ...events.map(eventUsage),
  ]);
  const recordById = new Map(visible.map((record) => [recordId(record), record]).filter(([id]) => Boolean(id)));
  const eventById = new Map(events.map((event) => [String(event?.id || ''), event]).filter(([id]) => Boolean(id)));
  const timeline = root.querySelector('[data-user-journal-timeline]');
  if (!timeline) return dispose;
  timeline.innerHTML = journalDayTimeline({ from: JOURNAL_DAY_FROM, to: JOURNAL_DAY_TO, usages, day });
  initJournalDayTimeline(timeline, {
    onUsageClick: ({ usageId }) => {
      const id = String(usageId || '');
      const event = eventById.get(id);
      if (event) {
        openUserEventView(event, { eventActions: accountEventActions, onClose: rerender });
        return;
      }
      const record = recordById.get(id);
      if (record) openUserRecord(record);
    },
    onSlotClick: ({ from }) => openDayAction({ root, day, from, targetSource, rerender }),
  });

  if (activeTime) {
    const now = new Date();
    const delay = Math.max(1000, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
    clockTimer = setTimeout(rerender, delay);
  }
  return dispose;
}

function monthRecordColor(record = {}) {
  const state = recordVisualState(record, { paid: paymentFor(record).paid });
  if (state === 'paid') return PAID_COLOR;
  if (state === 'no-show') return NO_SHOW_COLOR;
  return RECORD_COLOR;
}

function monthEventColor(event = {}) {
  const color = String(event?.color || '').trim();
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : EVENT_DEFAULT_COLOR;
}

function monthData(records = [], events = []) {
  const index = new Map();
  const day = (key) => {
    if (!index.has(key)) index.set(key, { records: [], events: [] });
    return index.get(key);
  };

  records.forEach((record) => {
    if (String(record?.status || '').toLowerCase() === 'cancelled') return;
    const key = String(record?.date || '').slice(0, 10);
    if (!key) return;
    day(key).records.push(record);
  });
  events.forEach((event) => {
    const key = String(event?.date || '').slice(0, 10);
    if (!key) return;
    day(key).events.push(event);
  });
  return index;
}

function monthUsageInterval(value = {}, color = EVENT_DEFAULT_COLOR) {
  const start = usageMinutes(value?.from);
  const rawEnd = usageMinutes(value?.to);
  if (start == null || rawEnd == null || rawEnd === start) return null;
  const end = rawEnd > start ? rawEnd : rawEnd + 24 * 60;
  return { start, end, color };
}

function monthDateContent(day = {}) {
  const records = Array.isArray(day?.records) ? day.records : [];
  const events = Array.isArray(day?.events) ? day.events : [];
  const intervals = [
    ...records.map((record) => monthUsageInterval(record, monthRecordColor(record))),
    ...events.map((event) => monthUsageInterval(event, monthEventColor(event))),
  ].filter(Boolean);

  const baselineStart = usageMinutes(JOURNAL_DAY_FROM) ?? 0;
  const baselineEnd = usageMinutes(JOURNAL_DAY_TO) ?? 24 * 60;
  const rangeStart = Math.max(0, Math.min(baselineStart, ...intervals.map((item) => item.start)));
  const rangeEnd = Math.min(24 * 60, Math.max(baselineEnd, ...intervals.map((item) => item.end)));
  const total = Math.max(1, rangeEnd - rangeStart);
  const clipped = intervals.map((item) => ({
    ...item,
    start: Math.max(rangeStart, item.start),
    end: Math.min(rangeEnd, item.end),
  })).filter((item) => item.end > item.start);
  const boundaries = [...new Set([
    rangeStart,
    rangeEnd,
    ...clipped.flatMap((item) => [item.start, item.end]),
  ])].sort((left, right) => left - right);
  const pieces = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (end <= start) continue;
    const active = clipped.filter((item) => item.start < end && item.end > start);
    if (!active.length) continue;
    const colors = active.map((item) => item.color);
    const background = colors.length === 1
      ? colors[0]
      : `linear-gradient(180deg,${colors.flatMap((color, colorIndex) => {
        const from = colorIndex / colors.length * 100;
        const to = (colorIndex + 1) / colors.length * 100;
        return [`${color} ${from.toFixed(2)}%`, `${color} ${to.toFixed(2)}%`];
      }).join(',')})`;
    const left = (start - rangeStart) / total * 100;
    const width = (end - start) / total * 100;
    pieces.push(`<span class="calendar__date-fill-segment" style="left:${left.toFixed(3)}%;width:${width.toFixed(3)}%;background:${background}"></span>`);
  }

  const fill = pieces.length
    ? `<span class="calendar__date-fill" aria-hidden="true">${pieces.join('')}</span>`
    : '';
  const counts = [
    records.length ? `<span>${records.length} зап</span>` : '',
    events.length ? `<span>${events.length} соб</span>` : '',
  ].filter(Boolean).join('');
  const count = counts ? `<span class="calendar__date-count">${counts}</span>` : '';
  return `${fill}${count}`;
}

function renderMonth(root, { month, records, onDateSelect, onMonthChange }) {
  let disposed = false;
  let visibleMonth = new Date(month);

  const renderCalendar = () => {
    if (disposed || !root.isConnected) return;
    root.innerHTML = '<div data-user-journal-calendar></div>';
    const calendar = root.querySelector('[data-user-journal-calendar]');
    if (!calendar) return;
    const index = monthData(readRecords(records), getAccountEvents());
    initCalendar(calendar, {
      workingDates: [],
      month: visibleMonth,
      renderDateContent: ({ dateKey: key, isCurrentMonth }) => isCurrentMonth
        ? monthDateContent(index.get(key) || { records: [], events: [] })
        : '',
      resolveDateIndicators: () => [],
      onDateSelect: (key) => {
        const [year, monthNumber, day] = String(key).split('-').map(Number);
        if (year && monthNumber && day) onDateSelect(new Date(year, monthNumber - 1, day));
      },
      onMonthChange: (nextMonth) => {
        visibleMonth = new Date(nextMonth);
        onMonthChange(nextMonth);
      },
    });
  };

  renderCalendar();
  if (!accountEventsLoaded()) void loadAccountEvents().then(renderCalendar).catch(() => {});
  return () => { disposed = true; };
}

function listEntry(record, { focus = false } = {}) {
  const presentation = presentationFor(record);
  const payment = paymentFor(record);
  const id = recordId(record);
  return v2ListEntry({
    overline: presentation.workplaceName,
    title: presentation.name,
    subtitle: String(presentation.professional?.phone || presentation.professional?.uei || ''),
    rightTop: [shortDate(record?.date, ''), String(record?.from || '')].filter(Boolean).join(' · '),
    rightBottom: money(amountDue(record)),
    interactive: Boolean(id),
    data: id ? `data-user-journal-record="${escapeHtml(id)}"` : '',
    aria: id ? `Открыть запись ${presentation.name}` : '',
    className: [
      `journal-list-record--${recordVisualState(record, { paid: payment.paid })}`,
      focus ? 'journal-list-focus' : '',
    ].filter(Boolean).join(' '),
    initial: presentation.name.slice(0, 1).toUpperCase(),
  });
}

function eventId(event = {}) {
  return String(event?.id || '');
}

function eventAppointmentTime(event = {}, edge = 'from') {
  const date = String(event?.date || '').slice(0, 10);
  const minutes = usageMinutes(edge === 'to' ? event?.to : event?.from);
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || minutes == null) return NaN;
  const stamp = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Math.floor(minutes / 60), minutes % 60).getTime();
  if (!Number.isFinite(stamp)) return NaN;
  if (edge !== 'to') return stamp;
  const from = usageMinutes(event?.from);
  return from != null && minutes <= from ? stamp + 24 * 60 * 60 * 1000 : stamp;
}

function eventActivityTime(event = {}) {
  const activity = Date.parse(String(event?.updatedAt || event?.createdAt || ''));
  return Number.isFinite(activity) ? activity : eventAppointmentTime(event, 'from');
}

function eventListEntry(event, { focus = false } = {}) {
  const id = eventId(event);
  const title = String(event?.title || '').trim() || 'Событие';
  const description = String(event?.description || '').trim();
  const from = String(event?.from || '').trim();
  const to = String(event?.to || '').trim();
  const period = from && to ? `${from}–${to}` : from || to;
  return v2ListEntry({
    overline: 'Событие',
    title,
    subtitle: description,
    rightTop: [shortDate(event?.date, ''), period].filter(Boolean).join(' · '),
    leadingSwatch: monthEventColor(event),
    interactive: Boolean(id),
    data: id ? `data-user-journal-event="${escapeHtml(id)}"` : '',
    aria: id ? `Открыть событие ${title}` : '',
    className: focus ? 'journal-list-focus' : '',
    initial: 'С',
  });
}

function listItemAppointmentTime(item, edge = 'from') {
  const value = item?.type === 'event'
    ? eventAppointmentTime(item.value, edge)
    : recordAppointmentTime(item?.value, edge);
  return Number.isFinite(value) ? value : NaN;
}

function listItemEntry(item, { focus = false } = {}) {
  return item?.type === 'event'
    ? eventListEntry(item.value, { focus })
    : listEntry(item?.value, { focus });
}

function bindListItems(root, records, events, rerender) {
  const recordById = new Map(records.map((record) => [recordId(record), record]).filter(([id]) => Boolean(id)));
  root.querySelectorAll('[data-user-journal-record]').forEach((node) => node.addEventListener('click', () => {
    const record = recordById.get(String(node.dataset.userJournalRecord || ''));
    if (record) openUserRecord(record);
  }));

  const eventById = new Map(events.map((event) => [eventId(event), event]).filter(([id]) => Boolean(id)));
  root.querySelectorAll('[data-user-journal-event]').forEach((node) => node.addEventListener('click', () => {
    const event = eventById.get(String(node.dataset.userJournalEvent || ''));
    if (event) openUserEventView(event, { eventActions: accountEventActions, onClose: rerender });
  }));
}

function renderList(root, { records, mode }) {
  let disposed = false;

  const draw = () => {
    if (disposed || !root.isConnected) return;
    const recordRows = readRecords(records);
    const eventRows = getAccountEvents();
    const items = [
      ...recordRows.map((value) => ({ type: 'record', value })),
      ...eventRows.map((value) => ({ type: 'event', value })),
    ];

    if (!items.length) {
      root.innerHTML = emptyState('Список', 'Записей и событий пока нет.');
      return;
    }

    if (mode === 'time') {
      const ordered = [...items].sort((a, b) => {
        const left = listItemAppointmentTime(a, 'from');
        const right = listItemAppointmentTime(b, 'from');
        if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
        if (!Number.isFinite(right)) return -1;
        return left - right;
      });
      const now = Date.now();
      const focus = ordered.findIndex((item) => {
        const end = listItemAppointmentTime(item, 'to');
        return Number.isFinite(end) && end > now;
      });
      root.innerHTML = v2ListEntries(ordered.map((item, index) => listItemEntry(item, { focus: index === focus })));
      bindListItems(root, recordRows, eventRows, draw);
      return;
    }

    const now = Date.now();
    const prepared = items.map((item) => {
      if (item.type === 'event') {
        const end = eventAppointmentTime(item.value, 'to');
        return {
          ...item,
          completed: Number.isFinite(end) && end <= now,
          activity: eventActivityTime(item.value),
        };
      }
      const payment = paymentFor(item.value);
      const completed = isRecordCompletedSide(item.value, { paid: payment.paid, now });
      return {
        ...item,
        completed,
        activity: recordActivityTime(item.value, payment.activity, { completed }),
      };
    });
    const completed = prepared.filter((item) => item.completed)
      .sort((a, b) => (Number.isFinite(a.activity) ? a.activity : 0) - (Number.isFinite(b.activity) ? b.activity : 0));
    const pending = prepared.filter((item) => !item.completed)
      .sort((a, b) => (Number.isFinite(b.activity) ? b.activity : 0) - (Number.isFinite(a.activity) ? a.activity : 0));
    const ordered = [...completed, ...pending];
    root.innerHTML = v2ListEntries(ordered.map((item) => listItemEntry(item)));
    bindListItems(root, recordRows, eventRows, draw);
  };

  draw();
  if (!accountEventsLoaded()) void loadAccountEvents().then(draw).catch(() => {});
  return () => { disposed = true; };
}

export function renderJournal(root, options = {}) {
  let activeView = VIEWS.some((view) => view.id === options.initialView) ? options.initialView : 'day';
  let listMode = 'flow';
  let selectedDate = options.initialDate instanceof Date && !Number.isNaN(options.initialDate.getTime())
    ? new Date(options.initialDate)
    : new Date();
  let disposeView = () => {};
  const records = options.records;

  const render = () => {
    disposeView();
    disposeView = () => {};
    const secondary = activeView === 'list'
      ? viewNavigation({ views: LIST_MODES, activeView: listMode, ariaLabel: 'Режим списка' })
      : '<div data-user-journal-period-navigation></div>';
    const rows = setV2ZHeaderRows(root, [viewNavigation({ views: VIEWS, activeView }), secondary]);
    const primaryRoot = rows[0] || null;
    const secondaryRoot = rows[1] || null;
    root.innerHTML = '<div data-user-journal-view></div>';
    const viewRoot = root.querySelector('[data-user-journal-view]');
    if (!viewRoot) return;

    if (activeView === 'day') {
      const navigationRoot = secondaryRoot?.querySelector('[data-user-journal-period-navigation]') || secondaryRoot;
      disposeView = renderDay(viewRoot, {
        date: selectedDate,
        records,
        navigationRoot,
        onChange: (nextDate) => {
          selectedDate = nextDate;
          render();
        },
      });
    } else if (activeView === 'month') {
      disposeView = renderMonth(viewRoot, {
        month: selectedDate,
        records,
        onMonthChange: (nextMonth) => {
          const day = Math.min(selectedDate.getDate(), new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate());
          selectedDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day);
        },
        onDateSelect: (nextDate) => {
          selectedDate = nextDate;
          activeView = 'day';
          options.onViewChange?.(activeView);
          render();
        },
      });
    } else {
      disposeView = renderList(viewRoot, { records, mode: listMode });
      if (secondaryRoot) initViewNavigation(secondaryRoot, {
        views: LIST_MODES,
        activeView: listMode,
        onChange: (nextMode) => {
          listMode = nextMode;
          render();
        },
      });
    }

    if (primaryRoot) initViewNavigation(primaryRoot, {
      views: VIEWS,
      activeView,
      onChange: (nextView) => {
        activeView = nextView;
        options.onViewChange?.(activeView);
        render();
      },
    });
  };

  const refresh = () => {
    if (!root.isConnected || root.querySelector('[data-record-creation-flow]')) return;
    render();
  };
  root.userJournalRefresh = refresh;

  render();
  return () => {
    if (root.userJournalRefresh === refresh) delete root.userJournalRefresh;
    disposeView();
    clearV2ZHeaderRows(root);
    clearV2Y(root);
  };
}
