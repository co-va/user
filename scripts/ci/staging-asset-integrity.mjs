// Compare each shipped application asset against the exact checked-out revision.
// Run from staging for preview; run with CWD set to a main checkout for production.
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base = (process.env.USER_PREVIEW_BASE || 'https://user-volokovykh.msk1.amvera.tech').replace(/\/$/, '');
const built = await access('dist/index.html').then(() => true).catch(() => false);
const prefix = built ? 'dist/' : '';
const html = (await readFile(prefix + 'index.html')).toString('utf8');
const css = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((match) => match[1]);
assert.ok(css.length > 0, 'No application CSS declared in index.html');
assert.equal(new Set(css).size, css.length, 'Duplicate stylesheet in index.html');
if (!built) {
  for (const required of [
    'css/style.css',
    'ui/cards/entity-card-constructor.css',
    'ui/lists/list-entry.css',
    'ui/modals/modal.css',
    'ui/v2/v2.css',
  ]) assert.ok(css.includes(required), 'Required source stylesheet missing: ' + required);
} else {
  assert.equal(css.length, 1, 'Production must reference one bundled CSS file');
  assert.match(css[0], /^\/assets\/[0-9a-f]{20}\/styles-[0-9a-f]{20}\.css$/,
    'Production styles must be content-versioned');
}

async function javascriptFiles(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + item.name;
    if (item.isDirectory()) files.push(...await javascriptFiles(path));
    else if (item.isFile() && path.endsWith('.js')) files.push(path);
  }
  return files;
}

const js = built
  ? await javascriptFiles('dist/assets')
  : (await Promise.all(['core', 'user', 'ui'].map(javascriptFiles))).flat().sort();
async function allAssets(dir) {
  const results = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = dir + '/' + entry.name;
    if (entry.isDirectory()) results.push(...await allAssets(name));
    else if (entry.isFile()) results.push(name);
  }
  return results;
}
const expected = built
  ? ['index.html', 'service-worker.js', ...(await allAssets('dist/assets')).map((file) => file.slice(5))]
  : ['index.html', ...css, 'service-worker.js', ...js];
assert.equal(new Set(expected).size, expected.length, 'Duplicate expected asset');
if (built) {
  assert.ok(expected.length > 3, 'Production bundles missing');
  assert.ok(js.length > 0, 'Production ESM chunks missing');
}
const hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 12);
const expectedBytes = new Map(await Promise.all(expected.map(async (path) => [path, await readFile(prefix + path)])));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path) {
  const url = base + (path === 'index.html' ? '/' : '/' + path);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });
    if (!response.ok) return { path, status: response.status, note: 'HTTP' };
    const type = (response.headers.get('content-type') || '').toLowerCase();
    if (built && path.startsWith('assets/')) {
      const control = response.headers.get('cache-control') || '';
      if (!control.includes('immutable') || !control.includes('max-age=31536000')) {
        return { path, status: response.status, note: 'Missing immutable cache policy: ' + control };
      }
    }
    if (path.endsWith('.css') && !type.includes('text/css')) {
      return { path, status: response.status, note: 'Unexpected type ' + type };
    }
    if (path.endsWith('.js') && !type.includes('javascript')) {
      return { path, status: response.status, note: 'Unexpected type ' + type };
    }
    const actual = Buffer.from(await response.arrayBuffer());
    const wanted = expectedBytes.get(path);
    if (actual.equals(wanted)) return null;
    return { path, status: response.status, note: 'DIFFERENT_BYTES', actual: hash(actual), expected: hash(wanted) };
  } catch (error) {
    return { path, note: 'FETCH_FAILED ' + String(error?.message || error) };
  }
}

async function batch(paths) {
  let index = 0;
  const bad = [];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (index < paths.length) {
      const path = paths[index++];
      const failure = await get(path);
      if (failure) bad.push(failure);
    }
  }));
  return bad.sort((a, b) => a.path.localeCompare(b.path));
}

let pending = expected;
for (let attempt = 1; attempt <= 4; attempt++) {
  const bad = await batch(pending);
  console.log('Asset integrity pass ' + attempt + ': ' + (pending.length - bad.length) + '/' + pending.length + ' match, ' + bad.length + ' stale/missing');
  for (const fail of bad) console.error(JSON.stringify(fail));
  if (!bad.length) {
    console.log('PASS: ' + base + ' matches ' + (built ? 'compiled immutable' : 'staging source') +
      ' revision: ' + expected.length + ' assets, ' + css.length + ' active CSS');
    process.exit(0);
  }
  pending = bad.map((item) => item.path);
  if (attempt < 4) await delay(25_000);
}
console.error('FAIL: ' + base + ' differs from checked-out revision; no release claim allowed');
process.exit(1);
