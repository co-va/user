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
    title:String(item.title || item.documentId || 'Согласие'),
    version:item.displayVersion || item.documentVersion || 1,
    content:String(item.documentText || item.text || ''),
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
  })), { layout: 'rail' });
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

export async function openAccountConsentSettings(state, { tenantId = state?.tenantId, onChanged } = {}) {
  const scopeTenantId = String(tenantId || '');
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

  const consents = Array.isArray(consentState?.consents) ? consentState.consents : [];
  const content = `<div class="account-consent-sheet" data-v2-stage-gesture-ignore>
    ${consentCards(consents)}
  </div>`;
  const layer = mountModal(document.body, modal(content, {
    variant: 'x',
    title: 'Согласия',
    className: 'modal--consent-sheet',
  }));

  layer?.querySelectorAll('[data-account-consent-document]').forEach((node) => node.addEventListener('click', () => {
    const item = consents[Number(node.dataset.accountConsentDocument)];
    if (item) openConsentDocument(item);
  }));

  layer?.querySelectorAll('[data-account-consent-toggle]').forEach((node) => node.addEventListener('click', async () => {
    const consent = consents[Number(node.dataset.accountConsentToggle)];
    if (!consent?.documentId) return;
    if (consent.accepted) {
      confirmRevoke(consent, async () => {
        await revokeAccountConsent(scopeTenantId, consent.documentId);
        layer.v2Close?.();
        await onChanged?.(consent.documentId);
        await openAccountConsentSettings(state, { tenantId: scopeTenantId, onChanged });
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
      layer.v2Close?.();
      await onChanged?.(consent.documentId);
      await openAccountConsentSettings(state, { tenantId: scopeTenantId, onChanged });
    } catch (error) {
      node.disabled = false;
      openNotice({
        title: 'Согласие не сохранено',
        message: accountErrorMessage(error, 'Не удалось сохранить согласие'),
      });
    }
  }));

  return layer;
}
