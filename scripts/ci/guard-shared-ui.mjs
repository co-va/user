import '../check-ui-contract.mjs';
import { assert, count, read, walk, finish } from './guard-lib.mjs';

const v2 = read('ui/v2/v2.css');
const geometry = read('ui/v2/geometry.js');
const header = read('ui/v2/header.js');
const zStack = read('ui/v2/z-stack.js');
const zLayout = read('ui/v2/z-layout.js');
const surfaceHeaderStyles = read('ui/v2/surface-header.css');
const inputsStyles = read('ui/inputs/inputs.css');
const selectorStyles = read('ui/selectors/selectors.css');
const authStyles = read('ui/auth/auth.css');
const noteView = read('user/note-view.js');
const entity = read('ui/cards/entity-card-constructor.css');
const mini = read('ui/cards/mini-card.css');
const miniMarkup = read('ui/cards/mini-card.js');
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
assert(v2.includes('padding:0 18px calc(24px + env(safe-area-inset-bottom))'), 'Shared Z must delegate its top padding to the Header');
assert(v2.includes('right:0;bottom:0;padding-top:0;background:var(--v2-inner-surface)}'), 'Shared Q cannot add second top padding or a white background');
assert(zLayout.includes("const SURFACE_HEADER_SPACING = '12px'"), 'Shared Z/Q Header must own X = 12px');
assert(zLayout.includes('padding-top:var(--v2-surface-header-spacing)') && zLayout.includes('padding-bottom:var(--v2-surface-header-spacing)'), 'Both Header edges must retain X = 12px');
assert(zLayout.includes('gap:var(--v2-surface-header-spacing)'), 'Z/Q Header rows must use X = 12px');
assert(zLayout.includes("'min-height:36px'") && zLayout.includes("'min-height:12px'") &&
       zLayout.includes("'grid-column:2'") && zLayout.includes('grid-template-columns:24px minmax(0,1fr)'),
       'Empty Z/Q must be 12 + 12 + 12; content fills only the center');
const dismissStyle = read('ui/v2/z-affordance.js');
assert(dismissStyle.includes("'position:absolute'") && dismissStyle.includes("'top:50%'") &&
       dismissStyle.includes("'transform:translateY(-50%)'") &&
       dismissStyle.includes("'height:24px'"),
       'Arrow must stay centered without enlarging the 12px empty middle');
assert((surfaceHeaderStyles.match(/min-height:36px!important/g)||[]).length===2,
       'Empty Z and Q Header must both be 36px, never 28px or 48px');
assert(!/Z_HEADER_BODY_GAP|Q_HEADER_BODY_GAP/.test(zLayout), 'Legacy per-surface Header / Body gaps returned');
assert(!surfaceHeaderStyles.includes('padding-bottom:0!important') && !surfaceHeaderStyles.includes('margin-bottom:8px'), 'Local Header spacing override returned');
assert(v2.includes('.v2-q-title,.v2-z-title{box-sizing:border-box;display:flex;align-items:center;width:100%;min-width:0;height:46px;min-height:46px;max-height:46px;margin:0;border:0;padding:0;background:transparent;box-shadow:none;overflow:hidden;'), 'Text titles must be exactly 46px without input borders');
assert(noteView.includes('<h2 class="v2-q-title">Заметка</h2>') && !noteView.includes('user-note-shell-title'), 'Note editor must use standard Q title');
assert(!zStack.includes('padding-top:0'), 'Nested Z must inherit Shared Z top padding');
assert(v2.includes('--v2-card-width:min(68vw,258px)'), 'Shared F card width changed');
assert(v2.includes('--v2-card-height:min(47vh,344px)'), 'Shared F card height changed');
assert(rootSelectorCount(v2, '.v2-header') === 1, 'Shared H geometry must have one owner');
assert(rootSelectorCount(v2, '.v2-z') === 1, 'Shared Z geometry must have one owner');
assert(v2.includes('--v2-inner-surface:#F5F5F3;') && v2.includes('background:var(--v2-inner-surface);color:var(--v2-ink);box-shadow:-6px 2px 18px rgba(0,0,0,.10)') && v2.includes('padding-top:0;background:var(--v2-inner-surface)}'), 'Z/Q must use the shared warm #F5F5F3 surface');
assert(zLayout.includes("'background:var(--v2-inner-surface,#F5F5F3)'") && surfaceHeaderStyles.includes('background:var(--v2-inner-surface,#F5F5F3)!important;'), 'Z/Q Header must share the warm internal surface without a white strip');
assert(modalStyles.includes('.modal-sheet.modal--surface-app:not(.modal--technical){background:var(--v2-inner-surface,#F5F5F3)}'), 'All internal modal app surfaces must remain warm beige, unlike white editors');
assert(inputsStyles.includes('background:var(--white)') && selectorStyles.includes('background:var(--white)'), 'Inputs and selectors must stay white on warm Z/Q');
assert(v2.includes('.v2-layer{position:absolute;box-sizing:border-box;overflow:auto;background:var(--v2-inner-surface)') &&
       v2.includes('.v2-layer--technical{\n  background:var(--v2-white,#fff);'),
       'X/S/Q common surface must be warm; technical paper must stay pure white');
assert(modalStyles.includes('.v2-layer--bottom .modal-actions{') &&
       modalStyles.includes('background:var(--v2-inner-surface,#F5F5F3);') &&
       !/\.modal-sheet\.modal--bottom\.modal--[^\n]*background:var\(--white\)/.test(modalStyles),
       'Bottom X sheets and action footer cannot insert white backgrounds');
assert(read('ui/time/time.css').includes('.time-timeline{position:relative;display:grid;gap:0;background:var(--white)'), 'Journal striped time grid must stay white, independent of Z surface');
assert(shellStyles.includes('--ui-field-height:46px;') && shellStyles.includes('--ui-control-height:48px;'), '46px fields must be independent of unchanged buttons');
assert(inputsStyles.includes('height:var(--ui-field-height);min-height:var(--ui-field-height);max-height:var(--ui-field-height)'), 'Form fields must stay exactly 46px');
assert(profileStyles.includes('height:var(--ui-field-height);min-height:var(--ui-field-height);max-height:var(--ui-field-height)') && !profileStyles.includes('[data-v2-q-body]{padding-top:6px}'), 'Profile inputs must stay exactly 46px without Q gap');
assert(selectorStyles.includes('--ui-selector-control-height:var(--ui-field-height)') && ['.ui-select__control{','.ui-selector__option{','.ui-selector__search{'].every(selector=>{const value=selectorStyles.split(selector)[1]?.split('}')[0]||'';return value.includes('height:var(--ui-selector-control-height);min-height:var(--ui-selector-control-height);max-height:var(--ui-selector-control-height)')}), 'Selector trigger, options and search must stay exactly 46px');
assert(selectorStyles.includes('-webkit-line-clamp:2'), 'Selectors must fit two-line labels in 46px');
assert(!authStyles.includes('min-height:52px'), 'Account form must use shared 46px fields');
assert(read('ui/buttons/buttons.css').includes('--ui-button-height:var(--ui-control-height)'), 'Buttons must remain independent of fields');

assert(geometry.includes('headerHeight = 72'), 'Q geometry must follow shared H height');
assert(geometry.includes('base.left + safeEdge'), 'Q geometry must follow shared Z edge');
assert(count(geometry, 'export function v2QModalPortalGeometry') === 1, 'Q geometry must have one owner');

assert(entity.includes('width:min(338px,100%)'), 'Entity card width must remain 338px');
assert(entity.includes('aspect-ratio:338/213'), 'Entity card aspect ratio must remain 338/213');
assert(entity.includes('grid-template-rows:repeat(9,minmax(0,1fr))'), 'Entity card must keep 9 rows');
assert(rootSelectorCount(entity, '.entity-visual-card') === 1, 'Entity card geometry must have one owner');

// Approved across the platform: a single 290×200 Shared MiniCard shell for every data variant.
assert(rootSelectorCount(mini, '.mini-card') === 1, 'Mini card geometry must have one owner');
assert(mini.includes('.mini-card{--mini-card-width:290px;--mini-card-height:200px;'),
  'ALL MiniCards must use exactly the approved 290×200 geometry');
assert(mini.includes('grid-template-rows:auto minmax(0,1fr) auto'),
  'Shared MiniCard must keep fixed header, scrollable center and fixed footer');
assert(mini.includes('.mini-card__record-center{min-height:0;min-width:0;overflow-y:auto'),
  'Shared center must own all vertical scrolling');
assert(!/238px|144px|176px/.test(mini), 'Legacy MiniCard dimensions cannot return');
assert(miniMarkup.includes('function cardShell('), 'One shared MiniCard shell renderer is required');
assert(count(miniMarkup, 'return cardShell({') === 2, 'Record and generic variants must delegate to one MiniCard shell');
assert(!miniMarkup.includes('height:auto;min-height:176px'), 'MiniCard variable-height workaround cannot return');

const userHistory = read('user/account-shell.js');
const userRecordRuntime = read('ui/record/runtime.js');
const userJournal = read('user/journal.js');
const userConfirmation = read('user/record-create.js');
const userIntegrations = read('user/calendar-integrations.js');
const modalMarkup = read('ui/modals/index.js');
assert(miniMarkup.includes('function recordMarkup(layout = {}, { className = \'\', aria = \'\', interactive = false, data = \'\' } = {})'),
  'Record MiniCard must accept shared click/data attributes');
assert(miniMarkup.includes('return recordMarkup(recordLayout, { className, aria, interactive, data });'),
  'Record MiniCard must forward consumer interaction instead of dropping it');
assert(userHistory.includes('function contactRecordMiniCard(') &&
       userHistory.includes('showPaymentDetails: true') &&
       userHistory.includes('event.stopPropagation()') &&
       !userHistory.includes('readOnlyReceipt(') &&
       !userHistory.includes('.slice(0, 4)'),
  'Contact History and its Q details must reuse one complete Record MiniCard and preserve repeat separately');
assert(userRecordRuntime.includes('return miniCard({') &&
       userJournal.includes('const card = recordMiniCard({') &&
       userConfirmation.includes('recordMiniCard({') &&
       userIntegrations.includes('return miniCard({'),
  'Journal, confirmation, History, and Calendar integrations must all use the one shared MiniCard renderer');
assert(modalMarkup.includes("variant === 'technical' ? 'technical' : 's'"),
  'Technical notices must use the technical white sheet, never the informational S surface');
assert(!read('index.html').includes('ui/receipt/receipt.css') &&
       !walk('ui').some(file => file.startsWith('ui/receipt/')),
  'Retired independent receipt UI must not be shipped beside the shared Record MiniCard');


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

// The approved active data panel remains rectangular; the dead agreement
// table must not be kept alive merely to satisfy an obsolete guard.
const detailsDeclaration = pageStyles.split('.entity-details{')[1]?.split('}')[0] || '';
assert(detailsDeclaration.includes('border-radius:0;'),
  'Shared entity details must retain four 90-degree corners');


/* Full-size action buttons retain 48px. Form, selector and picker controls
   use the independent owner-approved 46px field token. */
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
  read('ui/time/time.css').includes('.time-picker__button{width:100%;height:var(--ui-field-height);min-height:var(--ui-field-height)') &&
  read('ui/duration/duration.css').includes('.duration-picker__button{width:100%;height:var(--ui-field-height);min-height:var(--ui-field-height)') &&
  read('ui/inputs/inputs.css').includes('min-height:var(--ui-field-height)') &&
  read('ui/colors/colors.css').includes('height:var(--ui-field-height);min-height:var(--ui-field-height)'),
  'Shared form, selector, time, duration and color pickers must all be exactly 46px');

// All small glyph controls are literally one 28×28 button; only the icon,
 // accessible label and event hook vary. No button-size subclasses are allowed.
const compactButtons = read('ui/buttons/index.js');
const repeatedControls = read('ui/repeated-fields/index.js');
const linkControls = read('ui/links/index.js');
const profileControlsCss = read('ui/profile/profile.css');
const inputControlsCss = read('ui/inputs/inputs.css');
assert(actionButtonCss.includes('.ui-button{display:block;') &&
  !actionButtonCss.includes('.ui-button,.ui-add-control{') &&
  rootSelectorCount(actionButtonCss, '.ui-compact-control') === 1 &&
  actionButtonCss.includes('width:28px;min-width:28px;max-width:28px;height:28px;min-height:28px;max-height:28px;') &&
  !/\.ui-compact-control--(?:add|info|remove|copy)/.test(actionButtonCss) &&
  !/\.small-action-button(?:--info|--copy)?\{/.test(actionButtonCss),
  'Compact must have one 28×28 geometry for +, ×, info and copy');
assert(compactButtons.includes('const COMPACT_ICONS = Object.freeze({') &&
  compactButtons.includes('export function compactControl(') &&
  compactButtons.includes('return compactControl({ icon:') &&
  compactButtons.includes("icon: resolved,") &&
  !compactButtons.includes('ui-compact-control--'),
  'Every Compact variant must delegate to one shared renderer and icon map');
assert(repeatedControls.includes('compactRemoveControl(') &&
  linkControls.includes('compactRemoveControl(') &&
  repeatedControls.includes('compactAddControl(') &&
  linkControls.includes('compactAddControl(') &&
  !repeatedControls.includes('class="remove-button"') &&
  !linkControls.includes('class="remove-button"'),
  'All repeated contact/link actions must consume Shared Compact');
assert(inputControlsCss.includes('.array-group[data-repeated-add-placement="header"] .array-row{grid-template-columns:minmax(0,1fr) 28px}') &&
  inputControlsCss.includes('.link-row{display:grid;grid-template-columns:minmax(96px,.8fr) minmax(0,1.5fr) 28px;') &&
  !inputControlsCss.includes('.array-row__add{width:40px') &&
  !profileControlsCss.includes('.array-group__header .array-row__add{'),
  'All compact action slots must be 28px with no local size overrides');
const calendarControls = read('ui/calendar/calendar.js');
const calendarControlsCss = read('ui/calendar/calendar.css');
assert(miniMarkup.includes("import { compactControl } from '../buttons/index.js';") &&
  count(miniMarkup, 'compactControl({') >= 2 &&
  !miniMarkup.includes('class="mini-card__record-action') &&
  !miniMarkup.includes('class="mini-card__compact-action') &&
  mini.includes('.mini-card__record-top{display:grid;grid-template-columns:44px') &&
  mini.includes('.mini-card__record-action-placeholder{width:44px') &&
  !/\.mini-card__record-action\{[^}]*\b(?:width|height):/.test(mini) &&
  !/\.mini-card__compact-action\{[^}]*\b(?:width|height):/.test(mini),
  'MiniCard actions must use Compact 28px without modifying 290×200 card or 44px layout slots');
assert(calendarControls.includes("import { button, compactControl } from '../buttons/index.js';") &&
  calendarControls.includes("const previous = compactControl({ icon: 'previous'") &&
  calendarControls.includes("const following = compactControl({ icon: 'next'") &&
  !/\.calendar__month-button\{[^}]*\b(?:width|height):/.test(calendarControlsCss),
  'Day/month navigation arrows must use the one Shared Compact button, not 36px local buttons');
assert(actionButtonCss.includes('.ui-compact-control::before{content:"";position:absolute;inset:-8px}') &&
  ['dark', 'secondary', 'outlined'].every(appearance => actionButtonCss.includes('data-compact-appearance="' + appearance + '"')),
  'Compact has one 28px button, expanded 44px tap area and three appearance variants');


assert(read('ui/profile/index.js').includes("button('Удалить фото', { variant: 'danger'"),
  'Delete-photo control must use the canonical pink danger button');
assert(!read('ui/buttons/buttons.css').includes('ui-button--delete-outline'),
  'Removed white delete-photo variant must not return');

const cardRenderer = read('ui/cards/entity-card-constructor.js');
assert(cardRenderer.includes('row.cells[col]') && cardRenderer.includes('data-entity-card-column='),
  'User must render Professional 9x3 card cells, not the retired row-only card');
assert(!cardRenderer.includes('mountEntityCardConstructor('),
  'User is read-only and must not restore a second Professional card editor');
assert(entity.includes('.entity-visual-card__row{display:grid;grid-template-columns:repeat(3'),
  'Professional card grid must preserve three-cell geometry in User');


// A retired accordion has no product owner; the obsolete CSS must never return.
assert(!walk('ui').includes('ui/accordion/accordion.css'),
  'Retired accordion stylesheet must not exist');
assert(!read('index.html').includes('ui/accordion/'),
  'Do not load the retired accordion at bootstrap');
const accordionReferences = [...walk('core'), ...walk('user'), ...walk('ui')]
  .filter((file) => /\.(js|mjs|css|html)$/.test(file))
  .filter((file) => /\baccordion(?:[-_]|\b)/i.test(read(file)));
assert(accordionReferences.length === 0,
  'A retired accordion must not return as a parallel UI: ' + accordionReferences.join(', '));


const retiredPureCss = [
  'ui/cards/folder-card.css', 'ui/layout/layout.css',
];
for (const stylesheet of retiredPureCss) {
  assert(!walk('ui').includes(stylesheet) && !read('index.html').includes(stylesheet),
    'Dead standalone UI stylesheet must not be restored: ' + stylesheet);
}
const retiredUiClassReferences = [...walk('core'), ...walk('user'), ...walk('ui')]
  .filter((file) => /\.(js|mjs|css|html)$/.test(file))
  .filter((file) => /\b(?:ui-folder-(?:grid|card|list)|two-column-layout|column-layout)(?:\b|__|--)/.test(read(file)));
assert(retiredUiClassReferences.length === 0,
  'Retired folder/column layout UI must not come back: ' + retiredUiClassReferences.join(', '));


const bootstrapCss = read('index.html');
assert(bootstrapCss.includes('ui/selection/segment-control.css') &&
  read('ui/view-navigation/view-navigation.js').includes('class="segment-control"'),
  'Journal switch must retain its canonical CSS even when obsolete segment JS is removed');
assert(bootstrapCss.includes('ui/lists/list-entry.css') &&
  read('ui/lists/list-entry.css').includes('.list-entry{position:relative;'),
  'Approved WLIST2 styles must not be removed by generic CSS cleanup');


const retiredSourceFiles = [
  'ui/states/state-view.js', 'ui/states/state-view.css',
  'ui/selection/check-list.js', 'ui/selection/check-list.css',
  'ui/selection/segment-control.js',
];
for (const file of retiredSourceFiles) assert(!walk('ui').includes(file),
  'Retired disconnected Shared UI implementation must not be restored: ' + file);
assert(read('index.html').includes('ui/states/empty-state.css') &&
  read('ui/states/empty-state.css').startsWith('.empty-state{') &&
  read('ui/states/index.js').includes('export function emptyState('),
  'Keep the active Shared emptyState component and its original CSS');
assert(!read('ui/user-ui.js').includes('initSegmentControls') &&
  !read('ui/selection/index.js').includes('segment-control.js'),
  'Unused legacy segment JS must not be re-exported as a second UI owner');


const retiredBusinessFormCss = [
  'ui/cost/cost.css', 'ui/payment/payment.css', 'ui/workplaces/workplaces.css',
];
for (const file of retiredBusinessFormCss) {
  assert(!walk('ui').includes(file) && !read('index.html').includes(file),
    'Retired legacy business-form CSS must not return: ' + file);
}
const retiredBusinessClassOwners = [...walk('core'), ...walk('user'), ...walk('ui')]
  .filter((file) => /\.(js|mjs|css|html)$/.test(file))
  .filter((file) => /\b(?:cost-field|cost-range|cost-modes|work-time-row|workplace-content|workplace-control|workplace-selector|workplace-select-row|payment-summary-mini-card|payment-item-head|record-payment-actions)(?:\b|__|--)/.test(read(file)));
assert(retiredBusinessClassOwners.length === 0,
  'Unused payment/cost/workplace UI cannot remain referenced: ' + retiredBusinessClassOwners.join(', '));

assert(count(read('ui/inputs/inputs.css'), '.password-field__toggle{') === 1,
  'Password control must not have duplicate CSS declarations');
assert(count(read('ui/buttons/buttons.css'), '.sheet-icon-button{') === 1,
  'Sheet icon button must have one canonical geometry block');


const retiredStandaloneCss = [
  'ui/cards/entity-card-details.css', 'ui/lists/list.css',
  'ui/info/info.css', 'ui/tags/tags.css',
];
const indexedCssLinks = [...read('index.html').matchAll(/<link rel="stylesheet" href="([^"]+\.css)"/g)].map((match) => match[1]);
const actualCssSources = ['css/style.css', ...walk('ui').filter((file) => file.endsWith('.css'))].sort();
assert(new Set(indexedCssLinks).size === indexedCssLinks.length,
  'Every approved CSS stylesheet must be linked only once');
assert(JSON.stringify([...indexedCssLinks].sort()) === JSON.stringify(actualCssSources),
  'Shared CSS must have one registered bootstrap owner per actual file');
for (const file of retiredStandaloneCss) {
  assert(!walk('ui').includes(file) && !indexedCssLinks.includes(file),
    'Retired standalone CSS returned: ' + file);
}
const staleClassRefs = [...walk('core'), ...walk('user'), ...walk('ui')].filter((file) =>
  /\.(js|css|html)$/.test(file) &&
  /(?:ui-list(?:__|--|\{|\s)|ui-info(?:__|--|\{|\s)|ui-tags(?:__|--|\{|\s)|tag-manager-list|entity-card__details|ui-list-toolbar)/.test(read(file)));
assert(staleClassRefs.length === 0, 'Retired list/tag/info/details UI still referenced: ' + staleClassRefs.join(', '));


const sharedHeader = read('ui/header/index.js');
const sharedPage = read('ui/page/page.js');
const sharedCards = read('ui/cards/index.js');
assert(sharedHeader.includes('export function workspaceHeaderContext(') &&
  read('ui/header/header.css').includes('.workspace-header-context{display:none!important}'),
  'Active V2 workspace header metadata must not be removed during legacy header cleanup');
assert(!sharedHeader.includes('export function pageHeader(') &&
  !sharedHeader.includes('export function headerToggle(') &&
  !sharedHeader.includes('export function headerControl('),
  'Retired duplicate page/header control owners must not return');
assert(sharedPage.includes('export function details(') &&
  sharedPage.includes('export function setSharedActionVisible(') &&
  sharedPage.includes('export function actionBlock(') &&
  !sharedPage.includes('export function dataTable('),
  'Keep active Shared page/record detail and action helpers, not the retired table');
assert(sharedCards.includes('export function entityCardRail(') &&
  sharedCards.includes('export function entityCardStack(') &&
  !sharedCards.includes('export function entityCard('),
  'Active card stack/rail must remain; obsolete duplicate entityCard must not return');
assert(read('ui/page/page.css').includes('.entity-details{') &&
  read('ui/page/page.css').includes('.profile-actions{') &&
  !read('ui/page/page.css').includes('.page-header{'),
  'Active page details and action geometry must survive header cleanup');

finish('Shared UI');
