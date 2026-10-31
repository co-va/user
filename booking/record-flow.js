import {
  durationText,
  emptyState,
  initCalendar,
  initMultiSelect,
  openNotice,
  openRecordCreationOwner,
  recordCreationTimeRows,
  recordProcedureList,
} from '../ui/user-ui.js';

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function selectionEntry(provider, raw, workplaceId) {
  return {
    id: provider.procedureId(raw),
    name: provider.procedureName(raw),
    cost: provider.procedureCost(raw, workplaceId),
    duration: provider.procedureDuration(raw),
    raw,
  };
}

export function openRecords({
  person = null,
  workplaceId = '',
  date = '',
  procedures = [],
  provider = {},
  creationOwner = null,
  onCreated = () => {},
  onCancel = () => {},
  stepBack = false,
  onBackFromStart = null,
} = {}) {
  const source = provider;
  const state = {
    workplaceId: String(workplaceId || ''),
    date: date ? dateKey(date) : '',
    from: '',
    to: '',
    procedures: Array.isArray(procedures) ? procedures.map((entry) => ({ ...entry })) : [],
    person: person ? { ...person } : null,
  };

  const owner = creationOwner || openRecordCreationOwner({ onCancel });
  if (!owner) return null;
  const backEnabled = Boolean(stepBack);
  const stepHistory = [];
  let restoringHistory = false;
  let currentRenderer = null;
  let procedureController = null;

  const stateSnapshot = () => ({
    ...state,
    procedures: state.procedures.map((item) => ({ ...item })),
    person: state.person ? { ...state.person } : null,
  });

  const restoreState = (snapshot = {}) => {
    Object.assign(state, {
      ...snapshot,
      procedures: (snapshot.procedures || []).map((item) => ({ ...item })),
      person: snapshot.person ? { ...snapshot.person } : null,
    });
  };

  const enterStep = (step, renderer) => {
    currentRenderer = renderer;
    if (!backEnabled) return;
    if (restoringHistory) {
      restoringHistory = false;
      return;
    }
    const current = stepHistory.at(-1);
    if (current?.step === step && current?.renderer === renderer) return;
    stepHistory.push({ step, renderer, snapshot: stateSnapshot() });
  };

  const renderProcedures = () => {
    enterStep('procedures', renderProcedures);
    const available = source.procedures(state.workplaceId);
    const selected = new Map(state.procedures.map((entry) => [String(entry.id || ''), entry]));
    const body = recordProcedureList(available.map((item) => ({
      id: source.procedureId(item),
      name: source.procedureName(item),
      durationText: durationText(source.procedureDuration(item)),
      costText: source.procedureCost(item, state.workplaceId) !== ''
        ? `${source.procedureCost(item, state.workplaceId)} ₽`
        : '',
    })), {
      data: 'data-records-procedure',
      selected: [...selected.keys()],
      empty: 'Для этого рабочего пространства процедуры не настроены.',
    });
    const view = owner.render({
      step: 'procedures',
      body,
      action: { label: 'Далее', data: 'data-records-procedures-next', disabled: selected.size === 0 },
    });
    procedureController?.destroy?.();
    procedureController = initMultiSelect(view?.body, {
      selectedValues: [...selected.keys()],
      selector: '[data-records-procedure]',
      valueAttribute: 'recordsProcedure',
      onChange: (values) => {
        const next = new Map();
        values.forEach((id) => {
          const raw = available.find((item) => source.procedureId(item) === String(id));
          if (raw) next.set(String(id), selected.get(String(id)) || selectionEntry(source, raw, state.workplaceId));
        });
        selected.clear();
        next.forEach((value, key) => selected.set(key, value));
        state.procedures = [...selected.values()];
        const nextButton = view?.layer?.querySelector('[data-records-procedures-next]');
        if (nextButton) nextButton.disabled = selected.size === 0;
      },
    });
    view?.layer?.querySelector('[data-records-procedures-next]')?.addEventListener('click', () => {
      if (!selected.size) return;
      state.procedures = [...selected.values()];
      renderDates();
    });
  };

  const renderDates = () => {
    enterStep('date', renderDates);
    const dates = source.workingDates(state.workplaceId);
    const selectedDate = state.date ? new Date(`${state.date}T00:00:00`) : new Date();
    const view = owner.render({
      step: 'date',
      body: dates.length
        ? '<div data-records-calendar></div>'
        : emptyState('Свободных дат нет', 'В графике пока нет доступных дат.'),
    });
    const calendar = view?.body?.querySelector('[data-records-calendar]');
    if (!calendar) return;
    initCalendar(calendar, {
      month: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
      selectedValue: state.date || '',
      workingDates: dates,
      onDateSelect: (value) => {
        if (!dates.includes(value)) return;
        state.date = value;
        state.from = '';
        state.to = '';
        renderTimes();
      },
    });
  };

  const renderTimes = () => {
    enterStep('time', renderTimes);
    const rows = source.timeRows({
      workplaceId: state.workplaceId,
      date: state.date,
      procedures: state.procedures,
      state,
    });
    const view = owner.render({
      step: 'time',
      body: `<div class="record-screen record-screen--time">${rows.length
        ? recordCreationTimeRows(rows, { data: 'data-records-time', selected: state.from })
        : emptyState('Свободного времени нет', 'На эту дату нет доступного времени.')}</div>`,
    });
    view?.body?.querySelectorAll('[data-records-time]:not(:disabled)').forEach((node) => node.addEventListener('click', () => {
      const value = String(node.dataset.recordsTime || '');
      if (!value) return;
      const row = rows.find((item) => String(item.value ?? item.from ?? '') === value);
      state.from = value;
      state.to = String(row?.to || '');
      renderConfirmation();
    }));
  };

  const renderConfirmation = () => {
    enterStep('confirmation', renderConfirmation);
    const view = owner.render({
      step: 'confirmation',
      body: '<div></div>',
      action: { label: 'Подтвердить', data: 'data-records-confirm' },
    });
    view?.layer?.querySelector('[data-records-confirm]')?.addEventListener('click', async (event) => {
      const submit = event.currentTarget;
      if (!submit || submit.dataset.recordsBusy === 'true') return;
      submit.dataset.recordsBusy = 'true';
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      const release = () => {
        if (!submit.isConnected) return;
        delete submit.dataset.recordsBusy;
        submit.disabled = false;
        submit.removeAttribute('aria-busy');
      };
      try {
        const saved = await source.create(state);
        if (!saved) {
          release();
          return;
        }
        procedureController?.destroy?.();
        owner.commit();
        onCreated(saved, stateSnapshot());
      } catch (error) {
        if (source.onCreateError) source.onCreateError(error, state, { renderTimes, renderConfirmation });
        else openNotice({ title: 'Запись недоступна', message: 'Не удалось создать.' });
        release();
      }
    });
  };

  const backFromCurrentStep = () => {
    if (!backEnabled) return false;
    if (stepHistory.length > 1) {
      stepHistory.pop();
      const previous = stepHistory.at(-1);
      if (!previous?.renderer) return false;
      restoreState(previous.snapshot);
      restoringHistory = true;
      previous.renderer();
      return true;
    }
    if (typeof onBackFromStart === 'function') return onBackFromStart(stateSnapshot()) !== false;
    owner.close();
    return true;
  };

  const start = () => {
    if (!state.workplaceId) {
      openNotice({ title: 'Запись недоступна', message: 'Рабочее пространство не выбрано.' });
      owner.close();
      return;
    }
    if (!state.procedures.length) renderProcedures();
    else if (!state.date) renderDates();
    else if (!state.from) renderTimes();
    else renderConfirmation();
  };

  owner.resumeRecord = () => {
    owner.setBackHandler?.(backEnabled ? backFromCurrentStep : null);
    currentRenderer?.();
  };
  owner.getRecordState = stateSnapshot;
  owner.setBackHandler?.(backEnabled ? backFromCurrentStep : null);
  start();
  return owner;
}
