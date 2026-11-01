function personName(person = {}) {
  return [person?.name, person?.surname].filter(Boolean).join(' ').trim() || 'Без имени';
}

function recordOption(record = {}, label = 'Запись') {
  return {
    value: `record:${String(record?.id || record?.sourceId || '')}`,
    label,
    meta: [String(record?.from || ''), personName(record?.person)].filter(Boolean).join(' · '),
  };
}

function eventOption(event = {}, label = 'Событие') {
  return {
    value: `event:${String(event?.id || event?.sourceId || '')}`,
    label,
    meta: [String(event?.from || ''), String(event?.title || 'Событие')].filter(Boolean).join(' · '),
    indicatorColor: String(event?.color || ''),
  };
}

function snapshotPerson(person = {}) {
  return {
    id: String(person?.id || ''),
    key: String(person?.key || ''),
    uei: String(person?.uei || ''),
    name: String(person?.name || ''),
    surname: String(person?.surname || ''),
  };
}

function targetSnapshot(target = null) {
  if (!target?.entity || (target.type !== 'record' && target.type !== 'event')) return null;
  const entity = target.entity;
  if (target.type === 'record') {
    return {
      type: 'record',
      id: String(entity?.id || entity?.sourceId || ''),
      date: String(entity?.date || '').slice(0, 10),
      from: String(entity?.from || '').slice(0, 5),
      to: String(entity?.to || '').slice(0, 5),
      workplaceId: String(entity?.workplaceId || ''),
      status: String(entity?.status || ''),
      person: snapshotPerson(entity?.person || {}),
    };
  }
  return {
    type: 'event',
    id: String(entity?.id || entity?.sourceId || ''),
    date: String(entity?.date || '').slice(0, 10),
    from: String(entity?.from || '').slice(0, 5),
    to: String(entity?.to || '').slice(0, 5),
    title: String(entity?.title || 'Событие'),
    color: String(entity?.color || ''),
  };
}

function storedTargetSnapshot(note = {}) {
  const snapshot = note?.context?.targetSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const type = snapshot.type === 'record' || snapshot.type === 'event' ? String(snapshot.type) : '';
  const id = String(snapshot.id || '');
  if (!type || !id || type !== note?.targetType || id !== String(note?.targetId || '')) return null;
  return { ...snapshot, type, id };
}

function liveTarget(type = '', id = '', source = null) {
  if (!id || !source) return null;
  if (type === 'record') {
    const record = source.readRecord?.(id) || null;
    return record ? { type, entity: record, historical: false, deleted: false } : null;
  }
  if (type === 'event') {
    const event = source.readEvent?.(id) || null;
    return event ? { type, entity: event, historical: false, deleted: false } : null;
  }
  return null;
}

export function noteTargetSnapshot(targetType = '', targetId = '', { source = null } = {}) {
  return targetSnapshot(liveTarget(targetType, targetId, source));
}

export function noteContextWithTarget(context = {}, targetType = '', targetId = '', { source = null } = {}) {
  const next = context && typeof context === 'object' && !Array.isArray(context) ? { ...context } : {};
  const type = targetType === 'record' || targetType === 'event' ? String(targetType) : '';
  const id = type ? String(targetId || '') : '';
  if (!type || !id) {
    delete next.targetSnapshot;
    return next;
  }
  const snapshot = noteTargetSnapshot(type, id, { source });
  if (snapshot) next.targetSnapshot = snapshot;
  else delete next.targetSnapshot;
  return next;
}

export function noteTargetOptions(date, { includeNote = null, source = null } = {}) {
  const records = source?.recordsForDay?.(date) || [];
  const events = source?.eventsForDay?.(date) || [];
  const options = [
    { value: '', label: 'Не прикреплено' },
    ...records.filter((record) => record?.status !== 'cancelled').map((record) => recordOption(record)),
    ...events.map((event) => eventOption(event)),
  ];
  const currentValue = noteTargetValue(includeNote || {});
  if (!currentValue || options.some((option) => String(option.value || '') === currentValue)) return options;
  const target = resolveNoteTarget(includeNote || {}, { source });
  if (!target) return options;
  options.push(target.type === 'record'
    ? recordOption(target.entity, target.deleted ? 'Запись удалена' : target.entity?.status === 'cancelled' ? 'Запись отменена' : 'Запись')
    : eventOption(target.entity, target.deleted ? 'Событие удалено' : 'Событие'));
  return options;
}

export function parseNoteTargetValue(value = '') {
  const match = String(value || '').match(/^(record|event):(.+)$/);
  return match ? { targetType: match[1], targetId: match[2] } : { targetType: '', targetId: '' };
}

export function noteTargetValue(note = {}) {
  const type = note?.targetType === 'record' || note?.targetType === 'event' ? String(note.targetType) : '';
  const id = String(note?.targetId || '');
  return type && id ? `${type}:${id}` : '';
}

export function resolveNoteTarget(note = {}, { source = null } = {}) {
  const type = note?.targetType === 'record' || note?.targetType === 'event' ? String(note.targetType) : '';
  const id = String(note?.targetId || '');
  if (!type || !id) return null;
  const live = liveTarget(type, id, source);
  if (live) return live;
  const snapshot = storedTargetSnapshot(note);
  return snapshot ? { type, entity: snapshot, historical: true, deleted: true } : null;
}

export function noteTargetLabel(note = {}, { source = null } = {}) {
  const target = resolveNoteTarget(note, { source });
  if (!target) return '';
  if (target.type === 'record') {
    const status = target.deleted ? 'Запись удалена' : target.entity?.status === 'cancelled' ? 'Запись отменена' : 'Запись';
    return `${status} · ${String(target.entity?.from || '')} · ${personName(target.entity?.person)}`;
  }
  return `${target.deleted ? 'Событие удалено' : 'Событие'} · ${String(target.entity?.from || '')} · ${String(target.entity?.title || 'Событие')}`;
}
