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
  openNotice,
  openRecordCreationOwner,
  shortDate,
  v2ListEntries,
  v2ListEntry,
  viewNavigation,
} from '../ui/user-ui.js';
import { getServiceUnseenState, loadDeletedRecordHistory, loadJournalHiddenRecords, hideJournalRecord, markRecordsSeen } from '../core/notifications/service-unseen.js';
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

function money(value) {
  const number = Math.max(0, Number(value) || 0);
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(number).replaceAll('\u00a0', ' ')} ₽`;
}

function readRecords(source) {
  const value = typeof source === 'function' ? source() : source;
  return Array.isArray(value) ? value : [];
}

function recordId(record = {}) {
  return String(record?.id || record?.sourceId || record?.recordId || '');
}

function recordKey(record = {}) {
  return JSON.stringify([String(record?.tenantId || ''), recordId(record)]);
}

function recordDurationLabel(record = {}) {
  const start = usageMinutes(record?.from);
  const end = usageMinutes(record?.to);
  const elapsed = start != null && end != null && end !== start
    ? (end - start + 1440) % 1440
    : (Array.isArray(record?.procedures) ? record.procedures : [])
      .reduce((sum, p) => sum + Math.max(0, Number(p?.duration) || 0), 0);
  if (!elapsed) return '';
  const hours = Math.floor(elapsed / 60);
  const minutes = elapsed % 60;
  return [hours ? `${hours} ч` : '', minutes ? `${minutes} мин` : ''].filter(Boolean).join(' ');
}

function recordPaymentLabel(record, payment) {
  const state = String(record?.payment?.state || '').toLowerCase();
  if (state === 'debt' || (payment.due > 0.009 && record?.attendance === 'arrived')) {
    return { label: 'Задолженность', key: 'debt' };
  }
  if (state === 'paid' || payment.paid) return { label: 'Оплачено', key: 'paid' };
  return { label: 'К оплате', key: 'due' };
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

function procedureRows(record = {}) {
  return (Array.isArray(record?.procedures) ? record.procedures : []).map((item) => ({
    label: String(item?.name || 'Процедура'),
    value: money(item?.cost ?? item?.price),
  }));
}

function openUserRecord(record) {
  const deleted = record?.deleted === true;
  const payment = deleted ? null : paymentFor(record);
  const body = readOnlyReceipt({
    status: deleted ? 'Удалена' : String(record?.status || '').toLowerCase() === 'cancelled' ? 'Отменена' : '',
    date: shortDate(record?.date, ''),
    time: String(record?.from || ''),
    items: deleted
      ? (Array.isArray(record?.procedures) ? record.procedures : []).map((item) => ({ label: String(item?.name || 'Процедура'), value: '' }))
      : procedureRows(record),
    totals: deleted ? [] : [
      { label: 'Стоимость', value: money(amountDue(record)) },
      payment.paidAmount > 0.009 ? { label: 'Оплачено', value: money(payment.paidAmount), strong: true } : null,
      !payment.paid && payment.due > 0.009 ? { label: 'К оплате', value: money(payment.due), strong: true } : null,
    ].filter(Boolean),
  });
  const canAct = Boolean(recordId(record) && String(record?.tenantId || ''));
  const actions = canAct
    ? `<div class="modal-actions">
        ${button('Повторить', { data: 'data-user-record-repeat' })}
        ${button('Удалить', { variant: 'danger', data: 'data-user-record-hide' })}
      </div>`
    : '';
  const layer = mountModal(document.body, modal(`${body}${actions}`, {
    variant: 'x',
    xRole: 'action',
    surface: 'app',
  }));
  layer?.querySelector('[data-user-record-repeat]')?.addEventListener('click', () => {
    layer.v2Close?.();
    window.dispatchEvent(new CustomEvent('cova:user-record-start', {
      detail: {
        contactId: String(record?.tenantId || ''),
        workplaceKey: String(record?.workplaceId || record?.workplaceKey || ''),
        ...(deleted ? {} : { repeatRequest: record }),
      },
    }));
  });
  layer?.querySelector('[data-user-record-hide]')?.addEventListener('click', async (event) => {
    const control = event.currentTarget;
    control.disabled = true;
    try {
      // User-only dismissal: never cancel or delete the underlying Record.
      const hidden = await hideJournalRecord(record?.tenantId, recordId(record));
      layer.v2Close?.();
      window.dispatchEvent(new CustomEvent('cova:user-record-hidden', { detail: hidden }));
    } catch (error) {
      control.disabled = false;
      openNotice({ title: 'Не удалось удалить из списка', message: String(error?.message || 'Повторите попытку.') });
    }
  });
  return layer;
}
function recordUsage(record) {
  const payment = paymentFor(record);
  return {
    ...record,
    type: 'record',
    sourceId: recordId(record),
    paid: payment.paid,
    financialTotal: amountDue(record),
  };
}

function eventUsage(event = {}) {
  return {
    ...event,
    type: 'event',
    sourceId: String(event?.id || ''),
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
    window.dispatchEvent(new CustomEvent('cova:user-record-open-contacts'));
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
  const rerender = () => {
    if (disposed || !root.isConnected) return;
    if (root.querySelector('[data-record-creation-flow]')) return;
    dispose();
    renderDay(root, { date, records, navigationRoot, onChange });
  };
  const dispose = () => {
    disposed = true;
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
  const notes = getAccountNotesForDay(day);
  const yRoot = setV2Y(root, noteReels(notes, {
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
  timeline.innerHTML = journalDayTimeline({ from: JOURNAL_DAY_FROM, to: JOURNAL_DAY_TO, usages });
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

  const rangeStart = usageMinutes(JOURNAL_DAY_FROM) ?? 0;
  const rangeEnd = usageMinutes(JOURNAL_DAY_TO) ?? 24 * 60;
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
    const width = (end - start) / total * 100;
    pieces.push(`<span class="calendar__date-fill-segment" style="width:${width.toFixed(3)}%;background:${background}"></span>`);
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

function listEntry(record) {
  const deleted = record?.deleted === true;
  // Deleted notice is already the only available information. Never request,
  // recalculate or invent the removed record's price and procedures.
  const payment = deleted ? null : paymentFor(record);
  const status = deleted ? null : recordPaymentLabel(record, payment);
  const procedures = (Array.isArray(record?.procedures) ? record.procedures : [])
    .map((item) => String(item?.name || '').trim())
    .filter(Boolean).join(' · ');
  const visual = deleted ? 'deleted' : recordVisualState(record, { paid: payment.paid });
  return v2ListEntry({
    columns: [
      [
        { value: 'Запись', strong: true, className: 'journal-record-label' },
        { value: procedures, muted: true, className: 'journal-record-procedures' },
        { value: recordDurationLabel(record), muted: true, className: 'journal-record-duration' },
      ],
      [
        { value: [shortDate(record?.date, ''), String(record?.from || '')].filter(Boolean).join(' · '), strong: true, className: 'journal-record-date' },
        deleted
          ? { value: 'Удалена', strong: true, className: 'journal-record-status--deleted' }
          : { value: money(amountDue(record)), strong: true, className: 'journal-record-total' },
        { value: deleted ? '' : status.label, className: deleted ? '' : `journal-record-status--${status.key}` },
      ],
    ],
    interactive: Boolean(recordId(record)),
    data: recordId(record) ? `data-user-journal-record="${escapeHtml(recordKey(record))}"` : '',
    aria: `Открыть запись ${[procedures, record?.date, record?.from].filter(Boolean).join(' ')}`,
    className: `journal-list-record journal-list-record--${visual}`,
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

function russianCount(value, one, few, many) {
  const number = Math.abs(Number(value) || 0);
  const mod100 = number % 100;
  const mod10 = number % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function eventDurationLabel(event = {}) {
  const from = usageMinutes(event?.from);
  const to = usageMinutes(event?.to);
  if (from == null || to == null || from === to) return '';
  let duration = to - from;
  if (duration < 0) duration += 24 * 60;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const parts = [];
  if (hours) parts.push(`${hours} ${russianCount(hours, 'час', 'часа', 'часов')}`);
  if (minutes) parts.push(`${minutes} ${russianCount(minutes, 'минута', 'минуты', 'минут')}`);
  return parts.join(' ');
}

function eventListEntry(event) {
  const id = eventId(event);
  const title = String(event?.title || '').trim() || 'Событие';
  const from = String(event?.from || '').trim();
  return v2ListEntry({
    columns: [
      [
        { value: 'Событие', muted: true },
        { value: title, strong: true },
      ],
      [],
      [
        { value: shortDate(event?.date, ''), strong: true },
        { value: from },
        { value: eventDurationLabel(event), muted: true },
      ],
    ],
    leadingSwatch: monthEventColor(event),
    interactive: Boolean(id),
    data: id ? `data-user-journal-event="${escapeHtml(id)}"` : '',
    aria: id ? `Открыть событие ${title}` : '',
    className: 'journal-list-event',
    initial: 'С',
  });
}

function deletedNoticeEntry(notice = {}) {
  return listEntry({ ...notice, id: notice.recordId, deleted: true });
}

function listItemAppointmentTime(item, edge = 'from') {
  if (item?.type === 'deleted-notice') {
    const scheduled = eventAppointmentTime(item.value, edge);
    return Number.isFinite(scheduled) ? scheduled : Date.parse(String(item.value?.removedAt || ''));
  }
  const value = item?.type === 'event'
    ? eventAppointmentTime(item.value, edge)
    : recordAppointmentTime(item?.value, edge);
  return Number.isFinite(value) ? value : NaN;
}

function listItemEntry(item) {
  if (item?.type === 'deleted-notice') return deletedNoticeEntry(item.value);
  return item?.type === 'event'
    ? eventListEntry(item.value)
    : listEntry(item?.value);
}

function bindListItems(root, records, events, deletedNotices, rerender) {
  const allRecords = [
    ...records,
    ...deletedNotices.map((notice) => ({ ...notice, id: notice.recordId, deleted: true })),
  ];
  const recordById = new Map(allRecords.map((record) => [recordKey(record), record]).filter(([, record]) => Boolean(recordId(record))));
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

function renderList(root, { records, mode, hiddenKeys }) {
  let disposed = false;
  let deletedNotices = [];
  let deletionHistoryError = false;

  const draw = () => {
    if (disposed || !root.isConnected) return;
    const recordRows = readRecords(records);
    const eventRows = getAccountEvents();
    const currentKeys = new Set(recordRows.map((row) => JSON.stringify([
      String(row.tenantId || ''), recordId(row),
    ])));
    const deletedRows = deletedNotices.filter((notice) =>
      !currentKeys.has(JSON.stringify([String(notice.tenantId || ''), String(notice.recordId || '')]))
      && !hiddenKeys.has(recordKey(notice)));
    const items = [
      ...recordRows.map((value) => ({ type: 'record', value })),
      ...eventRows.map((value) => ({ type: 'event', value })),
      ...deletedRows.map((value) => ({ type: 'deleted-notice', value })),
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
      root.innerHTML = v2ListEntries(ordered.map((item) => listItemEntry(item)));
      bindListItems(root, recordRows, eventRows, deletedRows, draw);
      return;
    }

    const now = Date.now();
    const prepared = items.map((item) => {
      if (item.type === 'deleted-notice') {
        return {
          ...item,
          completed: true,
          activity: Date.parse(String(item.value?.removedAt || '')) || 0,
        };
      }
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
    bindListItems(root, recordRows, eventRows, deletedRows, draw);
  };

  draw();
  void loadDeletedRecordHistory().then((items) => {
    if (disposed) return;
    deletedNotices = items;
    draw();
    // These cards are now displayed in Journal List; read state changes but history remains.
    const ids = [...new Set(items.filter((notice) => !notice.read)
      .map((notice) => String(notice.recordId || '')).filter(Boolean))];
    for (let i = 0; i < ids.length; i += 100) {
      void markRecordsSeen(ids.slice(i, i + 100), { force: true });
    }
  }).catch(() => {
    deletionHistoryError = true;
    if (!disposed && root.isConnected) {
      const error = document.createElement('div');
      error.className = 'muted';
      error.textContent = 'Историю удалённых записей не удалось загрузить.';
      root.prepend(error);
    }
  });
  if (!accountEventsLoaded()) void loadAccountEvents().then(draw).catch(() => {});
  return () => { disposed = true; };
}


function markOpenedJournalDaySeen(date, records) {
  if (typeof document === 'undefined' || document.hidden) return;
  const day = dateKey(date);
  const displayedRecordIds = new Set(readRecords(records)
    .filter((record) => String(record?.date || '').slice(0, 10) === day)
    .filter((record) => String(record?.status || '').toLowerCase() !== 'cancelled')
    .map(recordId)
    .filter(Boolean));
  const seenIds = getServiceUnseenState().items
    .filter((item) => item.date === day
      || item.recordIds.some((id) => displayedRecordIds.has(id)))
    .flatMap((item) => item.recordIds);
  if (seenIds.length) void markRecordsSeen(seenIds);
}

const RECORD_NOTICE_LABELS = {
  'booking.created': 'Запись создана',
  'booking.rescheduled': 'Запись перенесена',
  'booking.cancelled': 'Запись отменена',
  'booking.deleted': 'Запись удалена',
  'booking.confirmed': 'Запись подтверждена',
  'booking.no-show': 'Запись не состоялась',
  'booking.reminder': 'Напоминание о записи',
};

function openJournalNotices(root) {
  const items = getServiceUnseenState().items;
  if (!items.length) return;
  const rows = items.map((item) => {
    const date = String(item.date || '').slice(0, 10);
    const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU')
      : 'Дата записи не указана';
    return v2ListEntry({
      title: RECORD_NOTICE_LABELS[item.type] || 'Изменение записи',
      subtitle: dateLabel,
      initial: 'З',
    });
  });
  const layer = mountModal(document.body, modal(
    `<h2>Изменения в записях</h2>${v2ListEntries(rows)}
    <div class="modal-actions">${button('Отметить просмотренными', { data: 'data-journal-notices-seen' })}</div>
    <div class="muted" data-journal-notices-error aria-live="polite"></div>`,
    { variant: 'x', xRole: 'action', surface: 'app' },
  ));
  layer?.querySelector('[data-journal-notices-seen]')?.addEventListener('click', async (event) => {
    const control = event.currentTarget;
    control.disabled = true;
    const success = await markRecordsSeen(items.flatMap((item) => item.recordIds));
    if (success) {
      layer.v2Close?.();
      root.querySelector('[data-user-journal-notices-host]')?.replaceChildren();
    } else {
      control.disabled = false;
      const error = layer.querySelector('[data-journal-notices-error]');
      if (error) error.textContent = 'Не удалось отметить изменения. Повторите попытку.';
    }
  });
}

function renderJournalNotices(root) {
  const host = root.querySelector('[data-user-journal-notices-host]');
  if (!host) return;
  const { total } = getServiceUnseenState();
  host.innerHTML = total > 0
    ? v2ListEntries([v2ListEntry({
      title: `Изменения в записях: ${total}`,
      subtitle: 'Открыть и отметить просмотренными',
      initial: '!',
      interactive: true,
      data: 'data-user-journal-notices',
      aria: 'Просмотреть изменения записей',
    })])
    : '';
  host.querySelector('[data-user-journal-notices]')?.addEventListener('click', () => openJournalNotices(root));
}

export function renderJournal(root, options = {}) {
  let activeView = VIEWS.some((view) => view.id === options.initialView) ? options.initialView : 'day';
  let listMode = 'flow';
  let selectedDate = options.initialDate instanceof Date && !Number.isNaN(options.initialDate.getTime())
    ? new Date(options.initialDate)
    : new Date();
  let disposeView = () => {};
  const records = options.records;
  const hiddenKeys = new Set();
  const visibleRecords = () => readRecords(records).filter((record) => !hiddenKeys.has(recordKey(record)));

  const render = () => {
    disposeView();
    disposeView = () => {};
    const secondary = activeView === 'list'
      ? viewNavigation({ views: LIST_MODES, activeView: listMode, ariaLabel: 'Режим списка' })
      : '<div data-user-journal-period-navigation></div>';
    const rows = setV2ZHeaderRows(root, [viewNavigation({ views: VIEWS, activeView }), secondary]);
    const primaryRoot = rows[0] || null;
    const secondaryRoot = rows[1] || null;
    root.innerHTML = '<div data-user-journal-notices-host></div><div data-user-journal-view></div>';
    renderJournalNotices(root);
    const viewRoot = root.querySelector('[data-user-journal-view]');
    if (!viewRoot) return;

    if (activeView === 'day') {
      markOpenedJournalDaySeen(selectedDate, visibleRecords);
      const navigationRoot = secondaryRoot?.querySelector('[data-user-journal-period-navigation]') || secondaryRoot;
      disposeView = renderDay(viewRoot, {
        date: selectedDate,
        records: visibleRecords,
        navigationRoot,
        onChange: (nextDate) => {
          selectedDate = nextDate;
          render();
        },
      });
    } else if (activeView === 'month') {
      disposeView = renderMonth(viewRoot, {
        month: selectedDate,
        records: visibleRecords,
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
      disposeView = renderList(viewRoot, { records: visibleRecords, mode: listMode, hiddenKeys });
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
  const onRecordHidden = (event) => {
    const detail = event?.detail || {};
    if (!detail.tenantId || !detail.recordId) return;
    hiddenKeys.add(recordKey({ tenantId: detail.tenantId, id: detail.recordId }));
    refresh();
  };
  window.addEventListener('cova:user-record-hidden', onRecordHidden);
  // One account-scoped visibility read, not one request per deleted Record.
  void loadJournalHiddenRecords().then((items) => {
    if (!root.isConnected) return;
    let changed = false;
    for (const item of items) {
      const key = recordKey(item);
      if (!hiddenKeys.has(key)) { hiddenKeys.add(key); changed = true; }
    }
    if (changed) refresh();
  }).catch(() => {
    // Journal remains usable if the new Account visibility API is not yet deployed.
    // A requested deletion reports a clear error if persistence fails.
  });
  const onServiceUnseen = () => {
    if (!root.isConnected) return;
    renderJournalNotices(root);
    if (activeView === 'day') markOpenedJournalDaySeen(selectedDate, visibleRecords);
  };
  window.addEventListener('va-tools:service-unseen', onServiceUnseen);
  const onJournalFocus = () => {
    if (root.isConnected && activeView === 'day') markOpenedJournalDaySeen(selectedDate, visibleRecords);
  };
  document.addEventListener('visibilitychange', onJournalFocus);

  render();
  return () => {
    if (root.userJournalRefresh === refresh) delete root.userJournalRefresh;
    disposeView();
    window.removeEventListener('va-tools:service-unseen', onServiceUnseen);
    window.removeEventListener('cova:user-record-hidden', onRecordHidden);
    document.removeEventListener('visibilitychange', onJournalFocus);
    clearV2ZHeaderRows(root);
    clearV2Y(root);
  };
}
