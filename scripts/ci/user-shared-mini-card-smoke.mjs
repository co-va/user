import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { miniCard } from '../../ui/cards/mini-card.js';
import { recordMiniCard } from '../../ui/record/runtime.js';

const css = readFileSync(new URL('../../ui/cards/mini-card.css', import.meta.url), 'utf8');
assert.ok(css.includes('.mini-card{--mini-card-width:290px;--mini-card-height:200px;'),
  'MiniCard must have exactly one common 290×200 surface');
assert.doesNotMatch(css, /238px|144px|176px/, 'Legacy mini-card dimensions must not return');

function expectOneSharedShell(html, label) {
  assert.equal((html.match(/data-mini-card-ui="shared"/g) || []).length, 1, label + ': one shared shell');
  for (const region of ['head', 'center', 'footer']) {
    assert.ok(html.includes('mini-card__record-' + region), label + ': region ' + region);
  }
}

const provider = miniCard({
  title: 'Google Calendar', subtitle: 'Подключён', interactive: true,
  data: 'data-account-calendar-open="google"',
});
expectOneSharedShell(provider, 'Calendar integration');
assert.match(provider, /data-account-calendar-open="google"/, 'Integration activation is preserved');

const services = Array.from({ length: 7 }, (_, index) => ({
  name: 'Услуга ' + (index + 1),
  durationText: '30 мин',
  priceText: (index + 1) * 100 + ' ₽',
}));
const history = recordMiniCard({
  confirmation: true,
  viewer: true,
  workplace: 'Рабочее пространство',
  date: '13.11.26', from: '12:00', to: '14:00',
  procedures: services,
  details: [{ value: 'Оплачено', rightValue: '300 ₽' }],
  duration: '120 мин', discount: '200 ₽', total: '2 600 ₽',
  interactive: true,
  data: 'data-global-contact-history="3" data-v2-rail-current',
  compactAction: { label: '↻', data: 'data-global-contact-repeat="3"', aria: 'Повторить запись' },
});
expectOneSharedShell(history, 'Contact History');
assert.match(history, /data-global-contact-history="3"/, 'Card opening action must not disappear');
assert.match(history, /data-global-contact-repeat="3"/, 'Repeat remains a separate button');
assert.match(history, /role="button"/, 'Card opening stays keyboard-accessible');
assert.match(history, /data-v2-rail-current/, 'Current-history marker remains available');
for (const service of services) {
  assert.ok(history.includes(service.name), 'All 7 services must be rendered: ' + service.name);
}
assert.match(history, /Оплачено/, 'Payment information must survive in the scroll center');
assert.match(history, /mini-card__record-footer--triple/, 'History must keep one fixed three-column footer');

const confirmation = recordMiniCard({
  confirmation: true, workplace: 'Рабочее пространство', date: '13.11.26',
  from: '12:00', procedures: services, duration: '120 мин', total: '2 600 ₽',
});
expectOneSharedShell(confirmation, 'Booking confirmation');
assert.doesNotMatch(confirmation, /data-global-contact-repeat/, 'Confirmation must not invent a repeat action');

console.log('PASS: shared 290×200 MiniCard serves Calendar, History, 7 services, Q details, repeat and confirmation');
