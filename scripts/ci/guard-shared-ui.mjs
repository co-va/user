import { assert, count, read, walk, finish } from './guard-lib.mjs';

const v2 = read('ui/v2/v2.css');
const geometry = read('ui/v2/geometry.js');
const header = read('ui/v2/header.js');
const entity = read('ui/cards/entity-card-constructor.css');
const mini = read('ui/cards/mini-card.css');
const list = read('ui/lists/list-entry.css');

function rootSelectorCount(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (source.match(new RegExp(`(^|\\n)${escaped}\\{`, 'g')) || []).length;
}

// Shared UI contract for User + Professional. Product code must not grow a second CSS world.
assert(walk('user').every((file) => !file.endsWith('.css')), 'User product layer must not own a parallel CSS/UI layer');

assert(v2.includes('--v2-z-radius:34px'), 'Shared Z radius changed');
assert(v2.includes('--v2-z-layer-offset:12px'), 'Shared Z layer offset changed');
assert(v2.includes('--v2-edge:16px'), 'Shared Z edge changed');
assert(v2.includes('height:72px;') && v2.includes('flex:0 0 72px'), 'Shared H height changed');
assert(v2.includes('--v2-card-width:min(68vw,258px)'), 'Shared F card width changed');
assert(v2.includes('--v2-card-height:min(47vh,344px)'), 'Shared F card height changed');
assert(rootSelectorCount(v2, '.v2-header') === 1, 'Shared H geometry must have one owner');
assert(rootSelectorCount(v2, '.v2-z') === 1, 'Shared Z geometry must have one owner');

assert(geometry.includes('headerHeight = 72'), 'Q geometry must follow shared H height');
assert(geometry.includes('base.left + safeEdge'), 'Q geometry must follow shared Z edge');
assert(count(geometry, 'export function v2QModalPortalGeometry') === 1, 'Q geometry must have one owner');

assert(entity.includes('width:min(338px,100%)'), 'Entity card width must remain 338px');
assert(entity.includes('aspect-ratio:338/213'), 'Entity card aspect ratio must remain 338/213');
assert(entity.includes('grid-template-rows:repeat(9,minmax(0,1fr))'), 'Entity card must keep 9 rows');
assert(rootSelectorCount(entity, '.entity-visual-card') === 1, 'Entity card geometry must have one owner');

// Mini-card geometry is intentionally not frozen yet: it is pending product correction.
// CI only protects the single-owner rule so a second mini-card implementation cannot appear.
assert(rootSelectorCount(mini, '.mini-card') === 1, 'Mini card geometry must have one owner');

assert(list.includes('min-height:78px'), 'List entry geometry changed');
assert(count(list, '.list-entry{') === 1, 'List entry geometry must have one owner');

assert(header.includes("kind === 'chat'"), 'Shared D chat control missing');
assert(v2.includes('.v2-header__slot--d .v2-header__control--chat'), 'Shared D chat geometry missing');

finish('Shared UI');
