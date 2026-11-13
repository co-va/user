import { assert, count, read, finish } from './guard-lib.mjs';

const api = read('core/record/platform-api.js');
const flow = read('user/record-flow.js');
const create = read('user/record-create.js');

assert(api.includes("accountRequest('/account/record-targets'"), 'Record targets must come from Account');
assert(api.includes('/record-context'), 'Record context Account route missing');
assert(api.includes('/records`'), 'Record creation Account route missing');
assert(!api.includes('/online-booking/'), 'Retired online-booking route returned to Record');
assert(!api.includes('booking-targets'), 'Retired booking-targets route returned');
assert(!api.includes('bookingPrice'), 'Retired bookingPrice field returned');
assert(!api.includes('fetch('), 'Record API must not own a second network bridge');

for (const step of ['procedures', 'date', 'time', 'confirmation']) {
  assert(count(flow, `enterStep('${step}'`) === 1, `Record step ${step} must have one owner`);
}
assert(count(flow, 'export function openRecords(') === 1, 'Record flow must have one owner');
assert(flow.includes('const stepHistory = []'), 'Record back navigation history missing');
assert(flow.includes('backFromCurrentStep'), 'Record back navigation missing');
assert(flow.includes('owner.setBackHandler?.(backEnabled ? backFromCurrentStep : null)'), 'Record Q back handler missing');

assert(count(create, 'export async function openUserRecordContactSelector') === 1, 'Contact selection must have one owner');
assert(create.includes("step: 'contact'"), 'Record must begin from Contact selection when opened from Journal');
assert(create.includes("step: 'workplace'"), 'Workplace selection step missing');
assert(create.includes('if (workplaces.length === 1)'), 'Single workplace must remain skippable');
assert(create.includes('stepBack: true'), 'Record flow must preserve step-back navigation');
assert(create.includes('createContactRecord(id,'), 'Record creation must use canonical Account Record API');
assert(!read('user/account-shell.js').includes('readOnlyReceipt('), 'History details must not restore a second record receipt UI');
assert(!read('user/account-shell.js').includes('.slice(0, 4)'), 'Record History must show every service in the scrolling middle');

finish('Record');
