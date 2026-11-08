/*
 * dispatch() in src/background/router.js — the reply rules of the worker's message router.
 *
 * These are the T-002 acceptance items that cannot be checked by hand without shipping a handler
 * that throws: every message gets an answer, and the answer is always a plain object a caller can
 * read. A test failing here means some sendMessage in the UI would hang or receive junk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/background/router.js';

const UNKNOWN = { ok: false, error: 'unknown message type' };

const HANDLERS = Object.freeze({
  ping: async () => ({ ok: true, schemaVersion: 1 }),
  echo: async (msg) => ({ ok: true, got: msg.value }),
  'notes/get': async (msg) => ({ ok: true, id: msg.id }),
  boom: async () => { throw new Error('disk full'); },
  syncBoom: () => { throw new Error('thrown before any await'); },
  rejects: () => Promise.reject(new TypeError('bad patch')),
  throwsString: async () => { throw 'plain string'; },
  throwsNull: async () => { throw null; },
  throwsObject: async () => { throw { code: 42 }; },
});

// A throw is logged on purpose (the stack belongs in the worker's console). Silence it here, and
// check that it happened, so a dispatch that swallows errors without a trace fails the test.
function quietErrors(t) {
  return t.mock.method(console, 'error', () => {});
}

// ---------- Known types ----------
test('a known type resolves to its handler result', async () => {
  assert.deepEqual(await dispatch(HANDLERS, { type: 'ping' }), { ok: true, schemaVersion: 1 });
});

test('the handler receives the whole message', async () => {
  assert.deepEqual(await dispatch(HANDLERS, { type: 'echo', value: 'EXO.13.2' }), { ok: true, got: 'EXO.13.2' });
  assert.deepEqual(await dispatch(HANDLERS, { type: 'notes/get', id: 'n_abc' }), { ok: true, id: 'n_abc' });
});

// ---------- Unknown types (R5) ----------
test('an unknown type gets the unknown reply', async () => {
  assert.deepEqual(await dispatch(HANDLERS, { type: 'nope' }), UNKNOWN);
  assert.deepEqual(await dispatch(HANDLERS, { type: 42 }), UNKNOWN);
});

test('a missing type or a missing message gets the unknown reply', async () => {
  assert.deepEqual(await dispatch(HANDLERS, {}), UNKNOWN);
  assert.deepEqual(await dispatch(HANDLERS, null), UNKNOWN);
  assert.deepEqual(await dispatch(HANDLERS, undefined), UNKNOWN);
  assert.deepEqual(await dispatch(HANDLERS, 'ping'), UNKNOWN); // a bare string is not a message
});

// handlers['toString'] is Object.prototype.toString, found through the prototype chain. Calling it
// would "succeed" with the string "[object Undefined]" instead of an { ok } object.
test('names inherited from Object.prototype are unknown, not callable', async () => {
  for (const type of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf']) {
    assert.deepEqual(await dispatch(HANDLERS, { type }), UNKNOWN, type);
  }
});

// ---------- Throws (R4) ----------
test('an async throw resolves to ok:false with the message', async (t) => {
  const log = quietErrors(t);
  assert.deepEqual(await dispatch(HANDLERS, { type: 'boom' }), { ok: false, error: 'disk full' });
  assert.equal(log.mock.callCount(), 1, 'the error is logged once');
});

test('a synchronous throw from a non-async handler is caught too', async (t) => {
  quietErrors(t);
  assert.deepEqual(await dispatch(HANDLERS, { type: 'syncBoom' }), { ok: false, error: 'thrown before any await' });
});

test('a rejected promise resolves to ok:false', async (t) => {
  quietErrors(t);
  assert.deepEqual(await dispatch(HANDLERS, { type: 'rejects' }), { ok: false, error: 'bad patch' });
});

// sendResponse serializes the reply as JSON, and an Error or an arbitrary object comes out of that
// as {} or worse. Whatever was thrown, the caller must get a readable string.
test('whatever is thrown, error is a non-empty string', async (t) => {
  quietErrors(t);
  assert.deepEqual(await dispatch(HANDLERS, { type: 'throwsString' }), { ok: false, error: 'plain string' });
  for (const type of ['throwsNull', 'throwsObject']) {
    const res = await dispatch(HANDLERS, { type });
    assert.equal(res.ok, false, type);
    assert.equal(typeof res.error, 'string', type);
    assert.ok(res.error.length > 0, type);
  }
});
