import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  button, compactControl, compactAddControl, compactRemoveControl,
  smallActionButton, copyIconButton,
} from '../../ui/buttons/index.js';
import { repeatedField } from '../../ui/repeated-fields/index.js';
import { links } from '../../ui/links/index.js';

const styles = readFileSync(new URL('../../ui/buttons/buttons.css', import.meta.url), 'utf8');
const inputs = readFileSync(new URL('../../ui/inputs/inputs.css', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../../ui/profile/profile.css', import.meta.url), 'utf8');

function assertCompact(html, variant, data = '') {
  assert.match(html, /<button type="button" class="ui-compact-control /);
  assert.ok(html.includes('ui-compact-control--' + variant), 'Shared Compact variant: ' + variant);
  assert.ok(!html.includes('class="ui-button'), 'Compact cannot inherit the full-size button family');
  assert.ok(html.includes('aria-label="'), 'Every Compact control needs a readable accessible label');
  if (data) assert.ok(html.includes(data), 'Consumer data hook missing: ' + data);
}

const add = compactAddControl({ data: 'data-repeated-add="extraEmail"', aria: 'Добавить Email' });
assertCompact(add, 'add', 'data-repeated-add="extraEmail"');
assert.ok(add.includes('>+</button>'), 'Plus glyph must remain visible');

const remove = compactRemoveControl({ data: 'data-repeated-remove', aria: 'Удалить Email' });
assertCompact(remove, 'remove', 'data-repeated-remove');
assert.ok(remove.includes('>×</button>'), 'Delete-cross glyph must remain visible');

const info = smallActionButton({ aria: 'Информация' });
assertCompact(info, 'info');
assert.ok(info.includes('small-action-button__info'), 'Info glyph still uses its familiar appearance');
const copy = copyIconButton({ data: 'data-copy-value' });
assertCompact(copy, 'info', 'data-copy-value');

const email = repeatedField({
  label: 'Email', name: 'extraEmail', type: 'email', values: ['second@example.com'],
  addInHeader: true, showEmptyRow: false,
});
assert.equal((email.match(/ui-compact-control--add/g) || []).length, 1, 'Email has one add action in the header');
assert.equal((email.match(/ui-compact-control--remove/g) || []).length, 1, 'Email delete uses one Compact action');
assert.match(email, /data-repeated-remove/, 'Email deletion hook preserved');

const telegram = repeatedField({
  label: 'Telegram', name: 'extraTelegram', addInHeader: true, showEmptyRow: false,
  lead: '<input name="telegram">',
});
assert.equal((telegram.match(/ui-compact-control--add/g) || []).length, 1, 'Telegram uses the same plus');
assert.ok(!telegram.includes('ui-compact-control--remove'), 'Empty Telegram has no artificial delete');

const linkRows = links({
  links: [{ type: 'Сайт', url: 'https://example.org' }],
  name: 'profileLinks', label: 'Ссылки', addInHeader: true,
});
assert.equal((linkRows.match(/ui-compact-control--add/g) || []).length, 1, 'Links use one Compact plus');
assert.equal((linkRows.match(/ui-compact-control--remove/g) || []).length, 1, 'Links use one Compact cross');
assert.match(linkRows, /data-remove-link/, 'Link deletion hook preserved');

assert.match(button('Сохранить'), /class="ui-button /, 'Real action buttons must remain full-size');
assert.doesNotMatch(button('Сохранить'), /ui-compact-control/, 'Action buttons must not be compact');

assert.ok(styles.includes('.ui-button{display:block;box-sizing:border-box;width:100%;height:var(--ui-button-height);'),
  'Full-size 48px button has its own root geometry');
assert.ok(!styles.includes('.ui-button,.ui-add-control{'), 'The old full-size + inheritance is forbidden');
assert.ok(styles.includes('.ui-compact-control{appearance:none;-webkit-appearance:none;'),
  'All glyph actions must share one independent Compact root');
assert.ok(styles.includes('.ui-compact-control--add{width:28px;min-width:28px;max-width:28px;height:28px;'),
  'Compact + is a transparent 28×28 icon control');
assert.ok(styles.includes('.ui-compact-control--remove{width:24px;min-width:24px;max-width:24px;height:40px;'),
  'Compact delete glyph must use its independent 24×40 click region');
assert.ok(styles.includes('.ui-compact-control--info{width:24px;min-width:24px;max-width:24px;height:24px;'),
  'Compact info preserves existing 24×24 geometry');
assert.ok(!styles.includes('.remove-button{width:40px'), 'Legacy grey 40px delete button must not return');
assert.ok(!inputs.includes('.array-row__add{width:40px'), 'Repeated fields must not re-style shared Compact add');
assert.ok(!inputs.includes('.ui-links__add{width:40px'), 'Links must not re-style shared Compact add');
assert.ok(!profile.includes('.array-group__header .array-row__add{'), 'Profile cannot override Compact button geometry');
assert.ok(!profile.includes('.ui-links__header .ui-links__add{'), 'Profile cannot override Compact button geometry');
assert.ok(compactControl({ kind: 'remove' }).includes('ui-compact-control--remove'),
  'All Compact variants must share one rendering owner');
console.log('PASS: Compact + / info / copy / delete share one owner without full-size inheritance');
