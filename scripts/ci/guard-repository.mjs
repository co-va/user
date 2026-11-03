import fs from 'node:fs';
import path from 'node:path';
import { ROOT, assert, read, textFiles, finish } from './guard-lib.mjs';

const markers = read('scripts/ci/retired-markers.txt')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

for (const file of textFiles()) {
  const source = read(file);
  for (const marker of markers) {
    assert(!source.includes(marker), `Retired marker returned: ${marker} in ${file}`);
  }
}

const environment = read('core/environment.js');
assert(environment.includes("export const USER_ORIGIN = 'https://user.va-tools.ru';"), 'User production origin changed');
assert(environment.includes("export const AMVERA_PREVIEW_API_BASE = '/api';"), 'Amvera preview API bridge missing');
assert(environment.includes("if (host.endsWith(AMVERA_SUFFIX)) return AMVERA_PREVIEW_API_BASE;"), 'Amvera preview must stay on preview API bridge');

const manifest = JSON.parse(read('manifest.webmanifest'));
assert(manifest.start_url === '/', 'Installed User app must open root /');
assert(manifest.scope === '/', 'Installed User app scope must remain /');

const nginx = read('nginx.conf');
assert(nginx.includes('server_name user.va-tools.ru _;'), 'Production User host missing');
assert(nginx.includes('server_name ~^.+\\.amvera\\.tech$;'), 'Amvera staging preview host missing');
assert(nginx.includes("if ($request_method !~ ^(GET|HEAD)$) { return 405; }"), 'Preview must remain read-only');
assert(nginx.includes('location = /api/account/login'), 'Preview login exception missing');
assert(nginx.includes('raw.githubusercontent.com/co-va/user/staging'), 'Preview must serve User staging');

const bridges = [
  'core/note/account-owner.js',
  'core/record/platform-api.js',
  'core/calendar-sync/account.js',
  'core/event/account-owner.js',
  'core/account/email.js',
  'core/account/password-reset.js',
  'core/notifications/account-push-api.js',
  'core/notifications/service-unseen.js',
];
for (const file of bridges) {
  const source = read(file);
  assert(!source.includes('fetch('), `${file} must not own a parallel network bridge`);
}

assert(!fs.existsSync(path.join(ROOT, '__noop__')), 'Temporary noop file must not exist');

finish('Repository');
