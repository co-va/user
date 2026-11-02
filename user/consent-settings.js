import {
  accountErrorMessage,
  getAccountConsentState,
  revokeAccountConsent,
  submitAccountConsents,
} from '../core/account/index.js';
import {
  button,
  documentTile,
  documentTiles,
  emptyState,
  mountModal,
  modal,
  openDocumentViewer,
  openNotice,
} from '../ui/user-ui.js';

function openConsentDocument(item = {}) {
  return openDocumentViewer({
    title: String(item.title || item.documentId || 'Согласие'),
    version: item.displayVersion || item.documentVersion || 1,
    content: String(item.documentText || item.text || ''),
  });
}

function consentCards(consents = []) {
  if (!consents.length) return emptyState('Согласий пока нет', 'Здесь появятся доступные согласия.');
  return documentTiles(consents.map((item, index) => documentTile({
    title: item?.title || item?.documentId || 'Согласие',
    version: item?.displayVersion || item?.documentVersion || 1,
    openData: `data-account-consent-document="${index}"`,
    toggleData: `data-account-consent-toggle="${index}"`,
    toggleChecked: Boolean(item?.accepted),
    aria: `Открыть документ ${item?.title || item?.documentId || ''}`,
    toggleAria: `${item?.accepted ? 'Отозвать' : 'Дать'} согласие: ${item?.title || item?.documentId || ''}`,
  })), { layout: 'stack' });
}

function confirmRevoke(consent, onConfirm) {
  const title = String(consent?.title || consent?.documentId || 'Согласие');
  const content = `<div class="form-grid">
    <div class="muted">После отзыва функции, которым необходимо это согласие, будут недоступны до повторного согласия.</div>
    ${button('Отозвать согласие', { variant: 'critical', data: 'data-confirm-consent-revoke' })}
    ${button('Отмена', { variant: 'outline', data: 'data-cancel-consent-revoke' })}
  </div>`;
  const layer = mountModal(document.body, modal(content, { variant: 'x', title }));
  layer?.querySelector('[data-cancel-consent-revoke]')?.addEventListener('click', () => layer.v2Close?.());
  layer?.querySelector('[data-confirm-consent-revoke]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await onConfirm?.();
      layer.v2Close?.();
    } catch (error) {
      event.currentTarget.disabled = false;
      openNotice({
        title: 'Согласие не отозвано',
        message: accountErrorMessage(error, 'Не удалось отозвать согласие'),
      });
    }
  });
}

async function resolveRecordAllowed(getRecordAllowed) {
  if (typeof getRecordAllowed !== 'function') return false;
  try {
    return (await getRecordAllowed()) === true;
  } catch {
    return false;
  }
}

export async function openAccountConsentSettings(state, {
  tenantId = state?.tenantId,
  getRecordAllowed,
  onRecord,
  onChanged,
} = {}) {
  const scopeTenantId = String(tenantId || '').trim();
  if (!scopeTenantId) {
    return openNotice({ title: 'Согласия недоступны', message: 'Не выбран контакт.' });
  }

  let consentState;
  try {
    consentState = await getAccountConsentState(scopeTenantId);
  } catch (error) {
    return openNotice({
      title: 'Согласия недоступны',
      message: accountErrorMessage(error, 'Не удалось загрузить согласия'),
    });
  }

  let consents = Array.isArray(consentState?.consents) ? consentState.consents : [];
  let recordAllowed = await resolveRecordAllowed(getRecordAllowed);
  const content = '<div class="account-consent-sheet" data-account-consent-content data-v2-stage-gesture-ignore></div>';
  const layer = mountModal(document.body, modal(content, {
    variant: 'q',
    title: 'Согласия',
    className: 'modal--consent-sheet',
  }));
  const host = layer?.querySelector('[data-account-consent-content]');
  if (!layer || !host) return layer;

  const refresh = async (documentId = '') => {
    consentState = await getAccountConsentState(scopeTenantId);
    consents = Array.isArray(consentState?.consents) ? consentState.consents : [];
    recordAllowed = await resolveRecordAllowed(getRecordAllowed);
    render();
    await onChanged?.(documentId, { recordAllowed });
  };

  const bind = () => {
    host.querySelectorAll('[data-account-consent-document]').forEach((node) => node.addEventListener('click', () => {
      const item = consents[Number(node.dataset.accountConsentDocument)];
      if (item) openConsentDocument(item);
    }));

    host.querySelectorAll('[data-account-consent-toggle]').forEach((node) => node.addEventListener('click', async () => {
      const consent = consents[Number(node.dataset.accountConsentToggle)];
      if (!consent?.documentId) return;
      if (consent.accepted) {
        confirmRevoke(consent, async () => {
          await revokeAccountConsent(scopeTenantId, consent.documentId);
          await refresh(consent.documentId);
        });
        return;
      }

      node.disabled = true;
      try {
        await submitAccountConsents(scopeTenantId, [{
          documentId: consent.documentId,
          documentVersion: Math.max(1, Number(consent.documentVersion || 1)),
          accepted: true,
          acceptedAt: new Date().toISOString(),
        }]);
        await refresh(consent.documentId);
      } catch (error) {
        node.disabled = false;
        openNotice({
          title: 'Согласие не сохранено',
          message: accountErrorMessage(error, 'Не удалось сохранить согласие'),
        });
      }
    }));

    host.querySelector('[data-account-consent-record]')?.addEventListener('click', () => {
      layer.v2Close?.();
      onRecord?.();
    });
  };

  function render() {
    host.innerHTML = `${consentCards(consents)}${recordAllowed ? `<div class="modal-actions">${button('Записаться', { data: 'data-account-consent-record' })}</div>` : ''}`;
    bind();
  }

  render();
  return layer;
}
