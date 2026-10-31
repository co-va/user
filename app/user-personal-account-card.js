import { entityVisualCard } from '../ui/user-ui.js';
import {
  loyaltyCardAppearance,
  loyaltyCardFields,
  loyaltyCardPhoto,
  loyaltyCardPhotoPosition,
} from '../core/loyalty/card-presentation.js';

function money(value) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value || 0)).replaceAll('\u00a0', ' ')} ₽`;
}

export function personalAccountVisualCard({
  title = '',
  balance = 0,
  debt = 0,
  data = '',
  aria = '',
  interactive = true,
} = {}) {
  const resolvedBalance = Math.max(0, Number(balance) || 0);
  const resolvedDebt = Math.max(0, Number(debt) || 0);
  const fields = loyaltyCardFields({
    title: title || 'Личный счёт',
    subtitle: 'Личный счёт',
    status: resolvedDebt > 0.009 ? 'Есть задолженность' : resolvedBalance > 0.009 ? 'Есть остаток' : 'Нулевой остаток',
    metaLeft: resolvedDebt > 0.009 ? 'Задолженность' : 'Денежный остаток',
    metaRight: money(resolvedDebt > 0.009 ? resolvedDebt : resolvedBalance),
  });
  return entityVisualCard({
    appearance: loyaltyCardAppearance('personal-account'),
    fields,
    image: loyaltyCardPhoto('personal-account'),
    imagePosition: loyaltyCardPhotoPosition('personal-account'),
    interactive,
    data,
    aria,
  });
}
