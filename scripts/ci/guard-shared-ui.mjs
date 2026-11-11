import { assert, count, read, walk, finish } from './guard-lib.mjs';

const v2 = read('ui/v2/v2.css');
const geometry = read('ui/v2/geometry.js');
const header = read('ui/v2/header.js');
const zStack = read('ui/v2/z-stack.js');
const entity = read('ui/cards/entity-card-constructor.css');
const mini = read('ui/cards/mini-card.css');
const list = read('ui/lists/list-entry.css');
const keyboard = read('ui/inputs/keyboard-runtime.js');
const keyboardStyles = read('ui/inputs/keyboard.css');
const recordStyles = read('ui/record/record.css');
const modalStyles = read('ui/modals/modal.css');
const vStyles = read('ui/v2/v.css');
const portal = read('ui/v2/modal-portal.js');
const swipe = read('ui/v2/swipe.js');
const horizontal = read('ui/v2/horizontal-affordance.js');
const documentStyles = read('ui/documents/document.css');
const pageStyles = read('ui/page/page.css');
const documentUI = read('ui/documents/index.js');
const profileStyles = read('ui/profile/profile.css');
const userMain = read('user/main.js');
const shellStyles = read('css/style.css');

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
assert(v2.includes('padding:22px 18px calc(24px + env(safe-area-inset-bottom))'), 'Shared Z padding changed');
assert(!zStack.includes('padding-top:0'), 'Nested Z must inherit Shared Z top padding');
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

// Shared keyboard contract: layout is stationary; all Q/Z/X editors use one
// visual inset and one measured action stack. Per-editor/variant overrides
// must not return as compatibility fixes.
assert(keyboard.includes("setRootPixel('--ui-keyboard-inset', inset)"), 'Shared keyboard viewport owner missing');
assert(keyboard.includes("area.style.setProperty('--ui-action-height'"), 'Shared action measurement owner missing');
assert(keyboardStyles.includes('--ui-keyboard-inset:0px'), 'Shared keyboard inset CSS missing');
assert(!userMain.includes('function syncViewport()'), 'Duplicate User viewport controller returned');
assert(!portal.includes('is-keyboard-visible'), 'Per-Q/X keyboard portal geometry returned');
assert(!modalStyles.includes('is-keyboard-visible'), 'Per-variant modal keyboard rules returned');
assert(!modalStyles.includes('.modal-actions>:nth-child('), 'Button-count geometry returned');
assert(!vStyles.includes('.modal-actions>:nth-child('), 'Button-count V offsets returned');
assert(!vStyles.includes('html.keyboard-open .v2-v'), 'Keyboard may not hide V');
assert(!profileStyles.includes('.modal--profile-editor .modal-actions'), 'Profile may not own action footer geometry');
assert(walk('ui').filter((file) => file.endsWith('.css') && file !== 'ui/inputs/keyboard.css')
  .every((file) => !read(file).includes('keyboard-open')), 'Keyboard-specific stylesheet exceptions returned');

// Keyboard geometry is a shared contract, not a profile/event/payment fix.
assert(shellStyles.includes('position:fixed;top:var(--ui-visual-top,0px);left:0;right:0'),
  'Shared root must compensate Safari visual viewport panning');
assert(!shellStyles.includes('body:has([data-v2-app]){position:fixed'),
  'Never nest a fixed application root inside a second fixed body');
assert(keyboard.includes("setRootPixel('--ui-visual-top', visualTop)"),
  'Visual viewport compensation must have one shared runtime owner');
assert(keyboard.includes('function followVisualViewport()'),
  'WebKit visual viewport panning must be tracked even when scroll events are delayed');
assert(!keyboard.includes('scrollBy('),
  'Scripted input scrolling must not compete with native WebKit focus scrolling');
assert(keyboardStyles.includes('margin-bottom:var(--ui-keyboard-inset)'),
  'Z and Q must only reduce their internal work area');
assert(keyboardStyles.includes('html.keyboard-open .modal-sheet.v2-layer--bottom'),
  'Every X sheet must have one upper stop above the keyboard');
assert(recordStyles.includes('.record-creation-flow__body{min-height:0;overflow:visible}'),
  'Record, Event and Note must use the existing shared Z/Q scroll area');
assert(!recordStyles.includes('.record-creation-flow__body{min-height:0;overflow:auto'),
  'Nested creation-flow scroller must not return');
assert(keyboardStyles.includes('overscroll-behavior:none'),
  'X must stop scrolling at actual content bounds');
assert(!modalStyles.includes('var(--ui-keyboard-inset'),
  'Z/Q action footer may not jump above the keyboard');
assert(modalStyles.includes('.v2-layer--bottom .modal-actions{\n  position:static;'),
  'X action must be the terminal scroll item');
assert(portal.includes('offsetTop: appRect.top'),
  'Q/X portal must use stable app coordinates');

// One permanent Shared UI contract for ALL technical modals and horizontal rails.
assert(v2.includes('.v2-layer--technical>.v2-layer__technical-body'),
  'Every technical sheet must use the Shared scroll body');
assert(v2.includes('.v2-layer--technical>.v2-layer__close'),
  'Technical X must be fixed by Shared UI');
assert(portal.includes('resolved === \'technical\'') && portal.includes('v2-layer__technical-body'),
  'Technical modal body must be created by the shared portal');
assert(!documentStyles.includes('.v2-layer--technical.document-viewer-sheet'),
  'Document-specific technical geometry must not return');
assert(!documentStyles.includes('.document-viewer-sheet .v2-layer__close'),
  'Document-specific X positioning must not return');
assert(modalStyles.includes('.modal-sheet.modal--surface-app:not(.modal--technical)'),
  'Technical paper must not inherit beige/grey app surface');
assert(documentStyles.includes('.document-viewer__content{') &&
  documentStyles.includes('overflow:visible;') &&
  documentStyles.includes('.document-page{') &&
  documentStyles.includes('background:transparent;'),
  'Document must use shared technical scroll body without opaque nested paper');
assert(!documentStyles.includes('overflow-y:auto;'),
  'Document-specific nested scroll container must not return');
assert(horizontal.includes('export function isV2HorizontalGestureTarget'),
  'Shared nested horizontal rail gesture detection missing');
assert(count(swipe, 'isV2HorizontalGestureTarget(event.target)') >= 3,
  'Z, Q and sticker swipes must all respect nested horizontal rails');
assert(documentUI.includes('data-v2-horizontal-rail'),
  'Documents must declare the same rail contract as other components');

// Shared data panels are always rectangles, as in Professional.
// No feature may add rounded data containers as a local exception.
for (const selector of ['.entity-details', '.agreements-summary']) {
  const marker = `${selector}{`;
  const declaration = pageStyles.split(marker)[1]?.split('}')[0] || '';
  assert(declaration.includes('border-radius:0;'),
    `Shared data panel ${selector} must have four 90-degree corners`);
}


/* Full-size Shared actions and form/picker controls use one geometry. Compact
   header, icon, and editor controls intentionally keep their own sizes. */
const actionButtonCss = read('ui/buttons/buttons.css');
const selectorCss = read('ui/selectors/selectors.css');
assert(shellStyles.includes('--ui-control-height:48px'), 'Shared control height token missing');
assert(actionButtonCss.includes('height:var(--ui-button-height);min-height:var(--ui-button-height)'),
  'Shared full-size buttons must use one fixed height');
assert(actionButtonCss.includes('@container ui-action-surface') && actionButtonCss.includes('max-inline-size:calc(100cqi'),
  'Shared action buttons must align with their footer');
assert(v2.includes('--v2-z-viewport-overscan:24px') &&
  v2.includes('container-name:ui-action-surface;container-type:inline-size;') &&
  read('ui/v2/z-layout.js').includes('var(--v2-z-viewport-overscan)'),
  'Shared Z/Q/X action geometry and Z overscan must use the same tokens');
assert(modalStyles.includes('[data-v2-z-body]{--ui-action-shift:') &&
  modalStyles.includes('var(--ui-action-inset)'),
  'Shared footer must keep centered token-based Z/Q alignment');
assert(selectorCss.includes('min-height:var(--ui-selector-control-height)') &&
  read('ui/time/time.css').includes('.time-picker__button{width:100%;min-height:var(--ui-control-height)') &&
  read('ui/duration/duration.css').includes('.duration-picker__button{width:100%;min-height:var(--ui-control-height)') &&
  read('ui/inputs/inputs.css').includes('min-height:var(--ui-control-height)'),
  'Full-size form and picker controls must match button height');

finish('Shared UI');
