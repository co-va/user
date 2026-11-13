import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  button, compactControl, compactAddControl, compactRemoveControl,
  smallActionButton, copyIconButton,
} from '../../ui/buttons/index.js';
import { repeatedField } from '../../ui/repeated-fields/index.js';
import { links } from '../../ui/links/index.js';
import { miniCard } from '../../ui/cards/mini-card.js';
import { calendar, dateNavigator } from '../../ui/calendar/calendar.js';

const styles = readFileSync(new URL('../../ui/buttons/buttons.css', import.meta.url), 'utf8');
const inputs = readFileSync(new URL('../../ui/inputs/inputs.css', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../../ui/profile/profile.css', import.meta.url), 'utf8');
const cardCss = readFileSync(new URL('../../ui/cards/mini-card.css', import.meta.url), 'utf8');
const calendarCss = readFileSync(new URL('../../ui/calendar/calendar.css', import.meta.url), 'utf8');

function assertCompact(markup, data = '') {
  assert.match(markup, /<button type="button" class="ui-compact-control(?:\s|")/,
    'Every icon must use one shared Compact element');
  assert.doesNotMatch(markup, /ui-compact-control--/, 'No compact geometry variants');
  assert.doesNotMatch(markup, /class="ui-button/, 'Compact must be independent of 48px buttons');
  assert.match(markup, /aria-label="/, 'Compact must preserve an accessible label');
  if (data) assert.ok(markup.includes(data), 'Consumer hook must be preserved: ' + data);
}

for (const icon of ['add', 'remove', 'info', 'copy', 'repeat', 'settings', 'previous', 'next']) {
  assertCompact(compactControl({ icon, data: 'data-compact-test="' + icon + '"' }),
    'data-compact-test="' + icon + '"');
}

const plus = compactAddControl({ data: 'data-repeated-add="extraEmail"', aria: 'Добавить Email' });
assertCompact(plus, 'data-repeated-add="extraEmail"');
assert.match(plus, />\+<\/button>/, 'Only the symbol + changes');

const cross = compactRemoveControl({ data: 'data-repeated-remove', aria: 'Удалить Email' });
assertCompact(cross, 'data-repeated-remove');
assert.ok(cross.includes('>×</span>'), 'Only the symbol × changes');

const info = smallActionButton({ aria: 'Информация' });
assertCompact(info);
assert.ok(info.includes('<circle'), 'Info uses a simple ⓘ icon inside the same Compact surface');
const copy = copyIconButton({ data: 'data-copy-value' });
assertCompact(copy, 'data-copy-value');
assert.ok(copy.includes('data-compact-copy-icon') && copy.includes('data-compact-copy-done'),
  'Copy icon and feedback share the same Compact surface');

const email = repeatedField({
  label: 'Email', name: 'extraEmail', type: 'email', values: ['second@example.com'],
  addInHeader: true, showEmptyRow: false,
});
assert.equal((email.match(/class="ui-compact-control(?:\s|")/g) || []).length, 2,
  'Email add and remove each use the single Compact renderer');
assert.match(email, /data-repeated-remove/, 'Email delete hook preserved');

const telegram = repeatedField({
  label: 'Telegram', name: 'extraTelegram', addInHeader: true, showEmptyRow: false,
  lead: '<input name="telegram">',
});
assert.equal((telegram.match(/class="ui-compact-control(?:\s|")/g) || []).length, 1,
  'Telegram without extra rows has only one Compact +');

const linkRows = links({
  links: [{ type: 'Сайт', url: 'https://example.org' }],
  name: 'profileLinks', label: 'Ссылки', addInHeader: true,
});
assert.equal((linkRows.match(/class="ui-compact-control(?:\s|")/g) || []).length, 2,
  'Links add/remove use the single Compact renderer');
assert.match(linkRows, /data-remove-link/, 'Link delete hook preserved');


const recordCard = miniCard({
  recordLayout: {
    headerMode: 'person', identity: 'Салон', moment: '13.11.26',
    rightAction: { label: '↻', data: 'data-compact-record-repeat', aria: 'Повторить запись' },
    leftAction: { label: '⚙', icon: 'settings', variant: 'secondary', data: 'data-compact-settings' },
  },
});
assertCompact(recordCard.match(/<button[^>]*data-compact-record-repeat[^>]*>[\s\S]*?<\/button>/)?.[0] || '', 'data-compact-record-repeat');
assertCompact(recordCard.match(/<button[^>]*data-compact-settings[^>]*>[\s\S]*?<\/button>/)?.[0] || '', 'data-compact-settings');
assert.ok(recordCard.includes('data-compact-appearance="dark"'), 'Record repeat retains dark surface');
assert.ok(recordCard.includes('data-compact-appearance="secondary"'), 'Record settings retain gray outline');

const genericCard = miniCard({
  title: 'История', interactive: true, data: 'data-compact-card-open',
  compactAction: { label: '↻', data: 'data-compact-card-repeat', aria: 'Повторить запись' },
});
assertCompact(genericCard.match(/<button[^>]*data-compact-card-repeat[^>]*>[\s\S]*?<\/button>/)?.[0] || '', 'data-compact-card-repeat');
assert.ok(genericCard.includes('mini-card__surface-action'), 'The rest of the card keeps its own opening event');
const dayNav = dateNavigator({ date: new Date(2026, 10, 13) });
assertCompact(dayNav.match(/<button[^>]*data-date-navigator-prev[^>]*>[\s\S]*?<\/button>/)?.[0] || '', 'data-date-navigator-prev');
assertCompact(dayNav.match(/<button[^>]*data-date-navigator-next[^>]*>[\s\S]*?<\/button>/)?.[0] || '', 'data-date-navigator-next');
const monthNav = calendar({ month: new Date(2026, 10, 1) });
assertCompact(monthNav.match(/<button[^>]*data-calendar-prev[^>]*>[\s\S]*?<\/button>/)?.[0] || '', 'data-calendar-prev');
assertCompact(monthNav.match(/<button[^>]*data-calendar-next[^>]*>[\s\S]*?<\/button>/)?.[0] || '', 'data-calendar-next');

assert.doesNotMatch(cardCss, /\.mini-card__record-action\{[^}]*\b(?:width|height):/, 'Record card may not resize Compact');
assert.doesNotMatch(cardCss, /\.mini-card__compact-action\{[^}]*\b(?:width|height):/, 'MiniCard overlay action may not resize Compact');
assert.doesNotMatch(calendarCss, /\.calendar__month-button\{[^}]*\b(?:width|height):/, 'Calendar arrows may not resize Compact');
assert.ok(styles.includes('.ui-compact-control::before{content:"";position:absolute;inset:-8px}'),
  'Shared Compact expands its target to 44px without changing its 28px element');
for (const appearance of ['dark', 'secondary', 'outlined']) {
  assert.ok(styles.includes('data-compact-appearance="' + appearance + '"'),
    'Every appearance is owned by the same Compact CSS: ' + appearance);
}

assert.match(button('Сохранить'), /class="ui-button /, 'Large action buttons must stay independent');
assert.doesNotMatch(button('Сохранить'), /ui-compact-control/, 'Large action may not become compact');

assert.ok(styles.includes('.ui-button{display:block;box-sizing:border-box;width:100%;height:var(--ui-button-height);'),
  '48px full button retains its own geometry');
assert.ok(!styles.includes('.ui-button,.ui-add-control{'), 'Compact must never inherit large button geometry');
assert.equal((styles.match(/\.ui-compact-control\{/g) || []).length, 1,
  'There must be exactly one Compact root CSS rule');
assert.ok(styles.includes('width:28px;min-width:28px;max-width:28px;height:28px;min-height:28px;max-height:28px;'),
  'One 28×28 geometry for every Compact icon');
assert.doesNotMatch(styles, /\.ui-compact-control--(?:add|remove|info)\{/,
  'No separate Compact button dimensions by icon');
assert.doesNotMatch(styles, /\.small-action-button(?:--(?:info|copy))?\{/,
  'Legacy small-action button geometry must not return');
assert.ok(!styles.includes('.remove-button{width:40px'), 'Old 40px delete control must not return');

assert.ok(inputs.includes('.array-group[data-repeated-add-placement="header"] .array-row{grid-template-columns:minmax(0,1fr) 28px}'),
  'Repeated row must reserve the same 28px slot for Compact ×');
assert.ok(inputs.includes('.link-row{display:grid;grid-template-columns:minmax(96px,.8fr) minmax(0,1.5fr) 28px;'),
  'Links must reserve the same 28px Compact slot');
assert.ok(!inputs.includes('.array-row__add{width:40px'), 'Inputs cannot resize Compact +');
assert.ok(!profile.includes('.array-group__header .array-row__add{'),
  'Profile cannot change Compact geometry');
console.log('PASS: one 28×28 Compact component for + / × / info / copy; icon changes, geometry does not');
