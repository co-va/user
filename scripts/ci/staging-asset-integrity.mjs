// Incident diagnostic: compare bytes served by Amvera's staging preview
// against the checked-out staging revision. Reachable HTML is insufficient:
// missing/stale CSS can silently destroy the entire interface while CI is green.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base = (process.env.USER_PREVIEW_BASE || 'https://user-volokovykh.msk1.amvera.tech').replace(/\/$/, '');
const html = await readFile('index.html');
const links = [...html.toString('utf8').matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((match) => match[1]);
assert.ok(links.length >= 35, `Unexpectedly short CSS list: ${links.length}`);
const expected = [
  'index.html', ...links,
  'user/main.js', 'user/account-shell.js', 'user/journal.js',
  'ui/user-ui.js', 'ui/view-navigation/view-navigation.js',
  'ui/inputs/index.js', 'ui/v2/index.js', 'ui/v2/modal-portal.js'
];
const hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 12);
const expectedBytes = new Map(await Promise.all(expected.map(async (path) => [path, await readFile(path)])));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path) {
  const url = path === 'index.html' ? base + '/' : base + '/' + path;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });
    if (!response.ok) return { path, status: response.status, note: 'HTTP' };
    const type = response.headers.get('content-type') || '';
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
const workers = 8;
async function batch(paths) {
  let index = 0;
  const bad = [];
  await Promise.all(Array.from({length: workers}, async () => {
    while (index < paths.length) {
      const path = paths[index++];
      const failure = await get(path);
      if (failure) bad.push(failure);
    }
  }));
  return bad.sort((a,b)=>a.path.localeCompare(b.path));
}

let pending = expected;
for (let attempt = 1; attempt <= 4; attempt++) {
  const bad = await batch(pending);
  console.log(`Asset integrity pass ${attempt}: ${pending.length-bad.length}/${pending.length} match, ${bad.length} stale/missing`);
  for (const fail of bad) console.error(JSON.stringify(fail));
  if (!bad.length) {
    console.log(`PASS: Amvera staging serves the SAME revision for index, ${links.length} CSS and ${expected.length-links.length-1} key JS files`);
    process.exit(0);
  }
  pending = bad.map((item) => item.path);
  if (attempt < 4) await delay(25_000);
}
console.error('FAIL: Live staging is inconsistent with current Git revision; do not claim UI restored from source checks.');
process.exit(1);
