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
const RECORD_COLOR = '#EFFFBB';
const PAID_COLOR = '#DDE8D7';
const NO_SHOW_COLOR = '#F1DADA';

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

function presentationFor(record, resolveRecordContext) {
  const resolved = typeof resolveRecordContext === 'function' ? (resolveRecordContext(record) || {}) : {};
  const professional = resolved?.professional && typeof resolved.professional === 'object' ? resolved.professional : {};
  const workplace = resolved?.workplace && typeof resolved.workplace === 'object' ? resolved.workplace : {};
  const name = [professional?.name, professional?.surname].filter(Boolean).join(' ').trim() || 'Профессионал';
  return {
    professional,
    workplace,
    name,
    workplaceName: String(workplace?.name || workplace?.title || 'Рабочее пространство'),
  };
}

function procedureRows(record = {}) {
  return (Array.isArray(record?.procedures) ? record.procedures : []).map((item) => ({
    label: String(item?.name || 'Процедура'),
    value: money(item?.cost ?? item?.price),
  }));
}

function openUserRecord(record, resolveRecordContext) {
  const presentation = presentationFor(record, resolveRecordContext);
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
    variant: 's',
    surface: 'app',
    title: presentation.name,
  }));
  layer?.querySelector('[data-user-record-repeat]')?.addEventListener('click', () => {
    layer.v2Close?.();
    window.dispatchEvent(new CustomEvent('cova:account-booking-start', {
      detail: {
        tenantId: String(record?.tenantId || ''),
        workplaceKey: String(record?.workplaceId || record?.workplaceKey || ''),
        repeatRequest: record,
        entry: 'journal',
      },
    }));
  });
  return layer;
}

function recordUsage(record, resolveRecordContext) {
  const presentation = presentationFor(record, resolveRecordContext);
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

function targetSourceFor(records, resolveRecordContext) {
  const allRecords = readRecords(records);
  return {
    readRecord: (id) => {
      const record = allRecords.find((item) => recordId(item) === String(id || '')) || null;
      return record ? recordUsage(record, resolveRecordContext) : null;
    },
    recordsForDay: (date) => allRecords
      .filter((record) => String(record?.date || '').slice(0, 10) === String(date || '').slice(0, 10))
      .map((record) => recordUsage(record, resolveRecordContext)),
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
    ${button('Записаться', { data: 'data-user-day-booking' })}
  </div>`, {
    variant: 'x',
    xRole: 'action',
    surface: 'app',
    title: 'Действие',
  }));
  layer?.querySelector('[data-user-day-booking]')?.addEventListener('click', () => {
    layer.v2Close?.();
    window.dispatchEvent(new CustomEvent('cova:account-journal-open-contacts'));
  });
  layer?.querySelector('[data-user-day-event]')?.addEventListener('click', () => {
    layer.v2Close?.();
    const owner = openRecordCreationOwner({
      surfaceRoot: root.closest('[data-v2-z],[data-v2-z-layer]'),
      bodyRoot: root,
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
    });
    if (!owner) return;
    owner.setShellHeader?.('<div class="record-creation-step-title">Заметка</div>');
    createUserNoteFlow({ owner, date: day, noteActions: accountNoteActions, targetSource, onCreated: rerender });
  });
}

function renderDay(root, { date, records, resolveRecordContext, navigationRoot, onChange }) {
  root.innerHTML = '<div data-user-journal-day-content><div data-user-journal-timeline></div></div>';
  if (navigationRoot) initDateNavigator(navigationRoot, { date, onChange });
  const day = dateKey(date);
  let disposed = false;
  let clockTimer = null;
  const rerender = () => {
    if (disposed || !root.isConnected) return;
    dispose();
    renderDay(root, { date, records, resolveRecordContext, navigationRoot, onChange });
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
  const targetSource = targetSourceFor(records, resolveRecordContext);
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
    ...visible.map((record) => recordUsage(record, resolveRecordContext)),
    ...events.map(eventUsage),
  ]);
  const recordById = new Map(visible.map((record) => [recordId(record), record]).filter(([id]) => Boolean(id)));
  const eventById = new Map(events.map((event) => [String(event?.id || ''), event]).filter(([id]) => Boolean(id)));
  const timeline = root.querySelector('[data-user-journal-timeline]');
  if (!timeline) return dispose;
  timeline.innerHTML = journalDayTimeline({ from: '09:00', to: '23:00', usages, day });
  initJournalDayTimeline(timeline, {
    onUsageClick: ({ usageId }) => {
      const id = String(usageId || '');
      const event = eventById.get(id);
      if (event) {
        openUserEventView(event, { eventActions: accountEventActions, onClose: rerender });
        return;
      }
      const record = recordById.get(id);
      if (record) openUserRecord(record, resolveRecordContext);
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

function minutesBetween(from = '', to = '') {
  const start = usageMinutes(from);
  const end = usageMinutes(to);
  return start == null || end == null || end <= start ? 0 : end - start;
}

function monthData(records = []) {
  const index = new Map();
  records.forEach((record) => {
    if (String(record?.status || '').toLowerCase() === 'cancelled') return;
    const key = String(record?.date || '').slice(0, 10);
    if (!key) return;
    const rows = index.get(key) || [];
    rows.push(record);
    index.set(key, rows);
  });
  return index;
}

function monthDateContent(records = []) {
  let paid = 0;
  let active = 0;
  let noShow = 0;
  for (const record of records) {
    const duration = minutesBetween(record?.from, record?.to);
    const state = recordVisualState(record, { paid: paymentFor(record).paid });
    if (state === 'paid') paid += duration;
    else if (state === 'no-show') noShow += duration;
    else active += duration;
  }
  const total = Math.max(1, paid + active + noShow);
  let cursor = 0;
  const stops = [];
  for (const item of [
    { value: paid, color: PAID_COLOR },
    { value: active, color: RECORD_COLOR },
    { value: noShow, color: NO_SHOW_COLOR },
  ]) {
    if (!(item.value > 0)) continue;
    const end = cursor + item.value / total * 100;
    stops.push(`${item.color} ${cursor.toFixed(2)}%`, `${item.color} ${end.toFixed(2)}%`);
    cursor = end;
  }
  const fill = stops.length
    ? `<span class="calendar__date-fill" style="--calendar-date-fill:linear-gradient(90deg,${stops.join(',')})" aria-hidden="true"></span>`
    : '';
  const count = records.length ? `<span class="calendar__date-count">${records.length} зап.</span>` : '';
  return `${fill}${count}`;
}

function renderMonth(root, { month, records, onDateSelect, onMonthChange }) {
  root.innerHTML = '<div data-user-journal-calendar></div>';
  const calendar = root.querySelector('[data-user-journal-calendar]');
  if (!calendar) return () => {};
  const index = monthData(readRecords(records));
  initCalendar(calendar, {
    workingDates: [],
    month,
    renderDateContent: ({ dateKey: key, isCurrentMonth }) => isCurrentMonth ? monthDateContent(index.get(key) || []) : '',
    resolveDateIndicators: () => [],
    onDateSelect: (key) => {
      const [year, monthNumber, day] = String(key).split('-').map(Number);
      if (year && monthNumber && day) onDateSelect(new Date(year, monthNumber - 1, day));
    },
    onMonthChange,
  });
  return () => {};
}

function listEntry(record, resolveRecordContext, { focus = false } = {}) {
  const presentation = presentationFor(record, resolveRecordContext);
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

function bindListRecords(root, records, resolveRecordContext) {
  const byId = new Map(records.map((record) => [recordId(record), record]).filter(([id]) => Boolean(id)));
  root.querySelectorAll('[data-user-journal-record]').forEach((node) => node.addEventListener('click', () => {
    const record = byId.get(String(node.dataset.userJournalRecord || ''));
    if (record) openUserRecord(record, resolveRecordContext);
  }));
}

function renderList(root, { records, resolveRecordContext, mode }) {
  const rows = readRecords(records);
  if (!rows.length) {
    root.innerHTML = emptyState('Список', 'Записей пока нет.');
    return;
  }
  if (mode === 'time') {
    const ordered = [...rows].sort((a, b) => recordAppointmentTime(a, 'from') - recordAppointmentTime(b, 'from'));
    const now = Date.now();
    const focus = ordered.findIndex((record) => recordAppointmentTime(record, 'to') > now);
    root.innerHTML = v2ListEntries(ordered.map((record, index) => listEntry(record, resolveRecordContext, { focus: index === focus })));
    bindListRecords(root, ordered, resolveRecordContext);
    return;
  }
  const prepared = rows.map((record) => {
    const payment = paymentFor(record);
    const completed = isRecordCompletedSide(record, { paid: payment.paid, now: Date.now() });
    return { record, payment, completed };
  });
  const completed = prepared.filter((item) => item.completed)
    .sort((a, b) => recordActivityTime(a.record, a.payment.activity, { completed: true }) - recordActivityTime(b.record, b.payment.activity, { completed: true }));
  const pending = prepared.filter((item) => !item.completed)
    .sort((a, b) => recordActivityTime(b.record, b.payment.activity) - recordActivityTime(a.record, a.payment.activity));
  const ordered = [...completed, ...pending].map((item) => item.record);
  root.innerHTML = v2ListEntries(ordered.map((record) => listEntry(record, resolveRecordContext)));
  bindListRecords(root, ordered, resolveRecordContext);
}

export function renderJournal(root, options = {}) {
  let activeView = VIEWS.some((view) => view.id === options.initialView) ? options.initialView : 'day';
  let listMode = 'flow';
  let selectedDate = options.initialDate instanceof Date && !Number.isNaN(options.initialDate.getTime())
    ? new Date(options.initialDate)
    : new Date();
  let disposeView = () => {};
  const records = options.records;
  const resolveRecordContext = typeof options.resolveRecordContext === 'function' ? options.resolveRecordContext : () => ({});

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
        resolveRecordContext,
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
      renderList(viewRoot, { records, resolveRecordContext, mode: listMode });
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

  render();
  return () => {
    disposeView();
    clearV2ZHeaderRows(root);
    clearV2Y(root);
  };
}
