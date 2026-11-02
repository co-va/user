import { accountRequest } from '../account/index.js';

function pushRequest(path, options = {}) {
  return accountRequest(
    `/account/push${path}`,
    { auth: true, ...options },
    'Не удалось выполнить настройку Push',
  );
}

export function getGlobalWebPushConfiguration() {
  return pushRequest('/config');
}

export function getGlobalWebPushSubscriptionState(endpoint) {
  const value = String(endpoint || '').trim();
  return pushRequest(`/subscription?endpoint=${encodeURIComponent(value)}`);
}

export function saveGlobalWebPushSubscription(subscription) {
  return pushRequest('/subscription', {
    method: 'PUT',
    body: JSON.stringify({ subscription }),
  });
}

export function deleteGlobalWebPushSubscription(endpoint) {
  return pushRequest('/subscription', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
}
