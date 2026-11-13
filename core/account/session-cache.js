import { getAccountToken } from './index.js';

// One session boundary for every account-scoped in-memory collection.
// A stale response may complete, but it cannot repopulate another account.
export function createAccountCacheScope(onReset) {
  let token = null;
  let epoch = 0;

  const reset = () => {
    epoch += 1;
    onReset();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('user:auth-logout', () => {
      token = null;
      reset();
    });
  }

  return {
    current() {
      const nextToken = getAccountToken();
      if (nextToken !== token) {
        token = nextToken;
        reset();
      }
      return { token, epoch };
    },
    matches(snapshot) {
      return snapshot?.token === getAccountToken() && snapshot?.epoch === epoch;
    },
  };
}
