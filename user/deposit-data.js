import { getAccountToken } from '../core/account/index.js';
import { API_BASE } from '../core/environment.js';

export async function getGlobalDeposits() {
  const token = getAccountToken('');
  if (!token) return [];
  const response = await fetch(`${API_BASE}/online-booking/account/deposits`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Не удалось загрузить Депозиты');
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}
