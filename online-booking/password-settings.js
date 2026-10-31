import { accountErrorMessage, changeAccountPassword, changeGlobalAccountPassword } from '../core/account/index.js';
import { openSharedPasswordAction } from '../ui/user-ui.js';

export function openAccountPasswordSettings(state) {
  return openSharedPasswordAction({
    onSubmit: async ({ currentPassword, newPassword }) => {
      try {
        if (state.globalAccount) await changeGlobalAccountPassword(currentPassword, newPassword);
        else await changeAccountPassword(state.tenantId, currentPassword, newPassword);
      } catch (error) {
        throw new Error(accountErrorMessage(error, 'Не удалось изменить пароль'));
      }
    },
  });
}
