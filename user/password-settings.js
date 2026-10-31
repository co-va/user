import { accountErrorMessage, changeGlobalAccountPassword } from '../core/account/index.js';
import { openSharedPasswordAction } from '../ui/user-ui.js';

export function openAccountPasswordSettings() {
  return openSharedPasswordAction({
    onSubmit: async ({ currentPassword, newPassword }) => {
      try {
        await changeGlobalAccountPassword(currentPassword, newPassword);
      } catch (error) {
        throw new Error(accountErrorMessage(error, 'Не удалось изменить пароль'));
      }
    },
  });
}
