import assert from 'node:assert/strict';

// Model two logins on the SAME browser page and API replies that arrive out of
// order. The real frontend API adapters are imported; no server data is used.
const storage = new Map();
globalThis.localStorage = {
  getItem: (name) => storage.get(name) ?? null,
  setItem: (name, value) => storage.set(name, String(value)),
  removeItem: (name) => storage.delete(name),
};
globalThis.window = new EventTarget();
globalThis.location = { hostname: '127.0.0.1' };
globalThis.__USER_API_BASE__ = 'https://user-session-test.invalid';

const counts = new Map();
const held = new Map();
const response = (body) => new Response(JSON.stringify(body), {
  status: 200, headers: { 'content-type':'application/json' },
});
globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  const token = new Headers(options.headers).get('authorization')?.replace(/^Bearer /, '') || '';
  const method = options.method || 'GET';
  const key = [token, method, path].join(':');
  counts.set(key, (counts.get(key) || 0) + 1);
  if (token === 'user-C' && method === 'GET' && ['/account/events','/account/notes'].includes(path)) {
    return await new Promise((resolve) => held.set(path, resolve));
  }
  if (method === 'GET' && path === '/account/events')
    return response([{id:token+'-event',date:'2026-11-13',from:'12:00',to:'13:00',title:'Событие '+token}]);
  if (method === 'GET' && path === '/account/notes')
    return response([{id:token+'-note',date:'2026-11-13',title:'Заметка '+token}]);
  if (method === 'PUT' && path.startsWith('/account/events/')) {
    const body=JSON.parse(options.body);
    return response(body.event);
  }
  if (method === 'PUT' && path.startsWith('/account/notes/')) {
    const body=JSON.parse(options.body);
    return response(body.note);
  }
  return response({});
};

const events = await import('../../core/event/account-owner.js');
const notes = await import('../../core/note/account-owner.js');

const use = (token) => storage.set('user.account.token', token);
const eventIds = () => events.getAccountEvents().map(x => x.id);
const noteIds = () => notes.getAccountNotes().map(x => x.id);

use('user-A');
await Promise.all([
  events.loadAccountEvents(), events.loadAccountEvents(),
  notes.loadAccountNotes(), notes.loadAccountNotes(),
]);
assert.deepEqual(eventIds(), ['user-A-event']);
assert.deepEqual(noteIds(), ['user-A-note']);
assert.equal(counts.get('user-A:GET:/account/events'), 1, 'Parallel event loads must coalesce');
assert.equal(counts.get('user-A:GET:/account/notes'), 1, 'Parallel note loads must coalesce');

use('user-B');
assert.deepEqual(eventIds(), [], 'New login must never see previous account events');
assert.deepEqual(noteIds(), [], 'New login must never see previous account notes');
assert.equal(events.getAccountEvent('user-A-event'), null);
assert.equal(notes.getAccountNote('user-A-note'), null);
assert.equal(events.accountEventsLoaded(), false);
assert.equal(notes.accountNotesLoaded(), false);
await Promise.all([events.loadAccountEvents(), notes.loadAccountNotes()]);
assert.deepEqual(eventIds(), ['user-B-event']);
assert.deepEqual(noteIds(), ['user-B-note']);
await Promise.all([events.loadAccountEvents(), notes.loadAccountNotes()]);
assert.equal(counts.get('user-B:GET:/account/events'), 1, 'Cached event GET must not duplicate');
assert.equal(counts.get('user-B:GET:/account/notes'), 1, 'Cached note GET must not duplicate');

// A slow reply from C must be discarded after D logs in, even if D's new
// request finishes first. Logout also wipes already loaded rows immediately.
use('user-C');
const oldEventLoad = events.loadAccountEvents();
const oldNoteLoad = notes.loadAccountNotes();
assert.equal(held.size, 2, 'Both old-session requests must be pending');
window.dispatchEvent(new Event('user:auth-logout'));
storage.delete('user.account.token');
assert.deepEqual(eventIds(), []);
assert.deepEqual(noteIds(), []);
use('user-D');
await Promise.all([events.loadAccountEvents(), notes.loadAccountNotes()]);
assert.deepEqual(eventIds(), ['user-D-event']);
assert.deepEqual(noteIds(), ['user-D-note']);
held.get('/account/events')(response([{id:'user-C-event',date:'2026-11-13'}]));
held.get('/account/notes')(response([{id:'user-C-note',date:'2026-11-13'}]));
await Promise.all([oldEventLoad,oldNoteLoad]);
assert.deepEqual(eventIds(), ['user-D-event'], 'Late C response may not replace D events');
assert.deepEqual(noteIds(), ['user-D-note'], 'Late C response may not replace D notes');

// PUT creates have client-owned IDs: a single confirmed save yields one row.
// A second account never inherits that saved row.
await events.createAccountEvent({ title:'Одно событие', date:'2026-11-13', from:'10:00',to:'11:00' });
await notes.createAccountNote({ title:'Одна заметка', date:'2026-11-13' });
assert.equal(new Set(eventIds()).size,eventIds().length);
assert.equal(new Set(noteIds()).size,noteIds().length);
use('user-E');
assert.deepEqual(eventIds(), []);
assert.deepEqual(noteIds(), []);
console.log('PASS: User events/notes cache isolation across logins and logout, coalesced GETs, late replies, unique saved rows');
