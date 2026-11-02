import { timeToMinutes, minutesToTime } from '../../core/time/math.js';

const DAY_MINUTES = 24 * 60;
const OVERLAP_CARD_OFFSET_PX = 44;

const escape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const moneyText = (value) => `${Math.max(0, Number(value) || 0).toLocaleString('ru-RU')} ₽`;

function recordMarkup(usage) {
  const person = usage?.person || {};
  const name = [person.name, person.surname].filter(Boolean).join(' ') || 'Без имени';
  const id = String(person.uei || person.id || '').trim();
  const identity = id ? `${escape(id)} - ${escape(name)}` : escape(name);
  const total = moneyText(usage?.financialTotal ?? usage?.finance?.planTotal ?? usage?.finance?.dueTotal ?? 0);
  const phone = person.phone ? `<span class="journal-record__phone">${escape(person.phone)}</span>` : '';
  const services = (usage.procedures || []).map((item) => `<span class="journal-record__service">${escape(item.name)}</span>`).join('');
  const statusClass = usage?.paid ? ' journal-record--paid' : usage?.attendance === 'no-show' ? ' journal-record--no-show' : '';
  const content = `<span class="journal-record__head"><strong class="journal-record__identity">${identity}</strong><strong class="journal-record__total">${escape(total)}</strong></span>${phone}${services}`;
  return `<button type="button" class="journal-record${statusClass}" data-journal-usage="${escape(usage.sourceId || usage.id)}">${content}</button>`;
}

function usageMarkup(usage, { overlapConflict = false } = {}) {
  if (usage?.type === 'record') return recordMarkup(usage);
  const title = escape(usage?.title || 'Событие');
  const period = `${escape(usage?.from || '')}–${escape(usage?.to || '')}`;
  const color = /^#[0-9A-Fa-f]{6}$/.test(String(usage?.color || '')) ? String(usage.color) : '#777A7D';
  const conflictClass = overlapConflict ? ' journal-record--event-overlap' : '';
  const content = `<span class="journal-event__time">${period}</span><strong class="journal-event__title">${title}</strong>`;
  return `<button type="button" class="journal-record journal-record--event${conflictClass}" style="--journal-event-color:${escape(color)}" data-journal-usage="${escape(usage.sourceId || usage.id)}">${content}</button>`;
}

function usageSegment(usage) {
  const start = timeToMinutes(usage?.from);
  const rawEnd = timeToMinutes(usage?.to);
  if (start == null || rawEnd == null || rawEnd === start) return null;
  const end = rawEnd > start ? rawEnd : rawEnd + DAY_MINUTES;
  const clippedStart = Math.max(0, start);
  const clippedEnd = Math.min(DAY_MINUTES, end);
  if (clippedEnd <= clippedStart) return null;
  return { start: clippedStart, end: clippedEnd };
}

function createdTime(usage = {}) {
  const value = Date.parse(String(usage?.createdAt || ''));
  return Number.isFinite(value) ? value : null;
}

function entriesOverlap(left, right) {
  return left.segment.start < right.segment.end && right.segment.start < left.segment.end;
}

function usageLaneLayout(values = []) {
  const entries = (Array.isArray(values) ? values : []).map((usage, index) => ({
    usage,
    index,
    segment: usageSegment(usage),
  })).filter((entry) => entry.segment && entry.usage?.overlap === true)
    .sort((a, b) => a.segment.start - b.segment.start || a.segment.end - b.segment.end || a.index - b.index);
  const layout = new Map();
  let group = [];
  let groupEnd = -1;

  const flush = () => {
    if (!group.length) return;
    const laneEnds = [];
    group.forEach((entry) => {
      let lane = laneEnds.findIndex((end) => end <= entry.segment.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = entry.segment.end;
      entry.lane = lane;
    });
    const laneCount = Math.max(1, laneEnds.length);
    group.forEach((entry) => {
      let overlapConflict = false;
      if (entry.usage?.type === 'event') {
        overlapConflict = group.some((other) => {
          if (other === entry || !entriesOverlap(entry, other)) return false;
          if (other.usage?.type !== 'event') return true;
          const entryCreated = createdTime(entry.usage);
          const otherCreated = createdTime(other.usage);
          if (entryCreated != null && otherCreated != null) return entryCreated > otherCreated;
          return entry.index > other.index;
        });
      }
      layout.set(entry.index, { lane: entry.lane, laneCount, overlapConflict });
    });
    group = [];
    groupEnd = -1;
  };

  entries.forEach((entry) => {
    if (group.length && entry.segment.start >= groupEnd) flush();
    group.push(entry);
    groupEnd = Math.max(groupEnd, entry.segment.end);
  });
  flush();
  return layout;
}

function timelineRange({ from, to, usages = [] } = {}) {
  const start = timeToMinutes(from);
  const end = timeToMinutes(to);
  if (start == null || end == null || end <= start) return null;
  const segments = (Array.isArray(usages) ? usages : []).map(usageSegment).filter(Boolean);
  return {
    start: Math.max(0, Math.min(start, ...segments.map((segment) => segment.start))),
    end: Math.min(DAY_MINUTES, Math.max(end, ...segments.map((segment) => segment.end))),
  };
}

function slotsMarkup(start, end, { interactiveStart = start, interactiveEnd = end } = {}) {
  const slots = [];
  for (let minutes = Math.ceil(start / 30) * 30; minutes < end; minutes += 30) {
    const next = Math.min(minutes + 30, end);
    const label = minutesToTime(minutes);
    const nextLabel = minutesToTime(next);
    const inner = `<span class="time-timeline__hour">${label}</span><span class="time-timeline__line"></span>`;
    const interactive = minutes >= interactiveStart && minutes < interactiveEnd;
    slots.push(interactive
      ? `<button type="button" class="time-timeline__slot" data-time-slot-from="${label}" data-time-slot-to="${nextLabel}" aria-label="${label}–${nextLabel}">${inner}</button>`
      : `<div class="time-timeline__slot" aria-hidden="true">${inner}</div>`);
  }
  return slots.join('');
}

export function journalDayTimeline({
  from = '09:00',
  to = '18:00',
  usages = [],
} = {}) {
  const interactiveStart = timeToMinutes(from), interactiveEnd = timeToMinutes(to);
  if (interactiveStart == null || interactiveEnd == null || interactiveEnd <= interactiveStart) return '';

  const values = Array.isArray(usages) ? usages : [];
  const range = timelineRange({ from, to, usages: values });
  if (!range || range.end <= range.start) return '';
  const { start, end } = range;
  const total = end - start;
  const laneLayout = usageLaneLayout(values);
  const overlays = values.map((usage, index) => {
    const segment = usageSegment(usage);
    if (!segment) return '';
    const clippedStart = Math.max(start, segment.start), clippedEnd = Math.min(end, segment.end);
    if (clippedEnd <= clippedStart) return '';
    const top = ((clippedStart - start) / total) * 100;
    const height = ((clippedEnd - clippedStart) / total) * 100;
    const lane = laneLayout.get(index);
    let horizontal = '';
    if (lane && lane.laneCount > 1) {
      const left = lane.lane * OVERLAP_CARD_OFFSET_PX;
      horizontal = `;left:${left}px;right:0;z-index:${lane.lane + 1}`;
    }
    return `<div class="time-timeline__usage" style="top:${top}%;height:${height}%${horizontal}">${usageMarkup(usage, { overlapConflict: Boolean(lane?.overlapConflict) })}</div>`;
  }).join('');

  return `<section class="time-timeline">${slotsMarkup(start, end, { interactiveStart, interactiveEnd })}<div class="time-timeline__usages">${overlays}</div></section>`;
}

export function initJournalDayTimeline(root, {
  onSlotClick = () => {},
  onUsageClick = () => {},
} = {}) {
  root.querySelectorAll('[data-time-slot-from]').forEach((slot) => slot.addEventListener('click', () => {
    onSlotClick({
      from: slot.dataset.timeSlotFrom || '',
      to: slot.dataset.timeSlotTo || '',
    });
  }));

  root.querySelectorAll('[data-journal-usage]').forEach((node) => node.addEventListener('click', (event) => {
    event.stopPropagation();
    const usageId = String(node.dataset.journalUsage || '');
    if (usageId) onUsageClick({ usageId });
  }));
}
