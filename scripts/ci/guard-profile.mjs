import { assert, count, read, finish } from './guard-lib.mjs';

const shell = read('user/account-shell.js');
const personal = read('user/personal-data.js');
const presentation = read('core/profile/card-presentation.js');

assert(count(shell, "{ id: 'profile', label: 'Профиль' }") === 1, 'Profile root must exist exactly once');
assert(shell.includes("return 'journal';"), 'Journal must remain the default User root');
assert(count(shell, 'async function renderGlobalProfile(') === 1, 'Profile renderer must have one owner');
assert(count(shell, 'const ACCOUNT_PROFILE_CARD_APPEARANCE') === 1, 'Profile summary appearance must have one owner');
assert(shell.includes("data: 'data-account-profile-card'"), 'Approved profile card entry is missing');
assert(shell.includes('openAccountPersonalDataZ(root, state'), 'Profile card must open the canonical personal-data editor');
assert(count(shell, 'function profileSummary(') === 1, 'Profile summary must not be duplicated');

assert(count(personal, 'export function openAccountPersonalDataZ') === 1, 'Personal-data editor must have one owner');
assert(personal.includes('openSharedPersonalDataEditor({'), 'Personal data must use the shared editor');
assert(personal.includes('saveActions.hidden = !dirty'), 'Profile save action must appear only for changed data');
assert(personal.includes('updateGlobalAccount(payload)'), 'Profile data must save through Account');
assert(personal.includes('changeAccountEmail(requestedEmail)'), 'Email change must keep verification flow');

assert(count(presentation, 'export function profileCardAppearance') === 1, 'Profile card appearance must have one owner');
assert(presentation.includes("{row:7,field:'name',zone:'full',align:'left',size:'l',bold:true}"), 'Approved profile name row changed');
assert(presentation.includes("{row:9,field:'phone',zone:'full',align:'left',size:'m'}"), 'Approved profile phone row changed');

finish('Profile');
