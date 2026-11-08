/*
 * src/shared/schema.js — the schema version, the id generator and the record defaults.
 *
 * Importing the module here is itself a test: it must load in plain Node, which fails at once if
 * anyone adds a chrome.* or document reference to a shared file (T-007 R3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, newId, NOTE_DEFAULTS, TOPIC_DEFAULTS, TAG_DEFAULTS } from '../src/shared/schema.js';

test('SCHEMA_VERSION is 1', () => {
  assert.equal(SCHEMA_VERSION, 1);
});

// ---------- newId ----------
test('newId is prefix, 8 base-36 time characters, 8 hex characters', () => {
  assert.match(newId('n'), /^n_[0-9a-z]{8}[0-9a-f]{8}$/);
  assert.match(newId('t'), /^t_[0-9a-z]{8}[0-9a-f]{8}$/);
});

test('newId does not repeat', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => newId('n')));
  assert.equal(ids.size, 1000);
});

// Plain string order must equal creation order. It does because base-36 digits 0-9a-z are also in
// ascending ASCII order, and the time part is a fixed 8 characters from 1972 until 2059. The times
// below are 1 ms apart across a 'z' -> '10' carry in the last two digits, plus a date near each end
// of that window, created out of order on purpose.
test('newId sorts by creation time', (t) => {
  const base = Date.UTC(2026, 10, 8);
  const carry = base - (base % 36 ** 2) + 36 ** 2; // the next time whose last two digits are "00"
  const times = [carry, base, Date.UTC(2059, 0, 1), carry - 1, carry + 1, Date.UTC(1973, 0, 1)];
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  const made = times.map((ms) => { now = ms; return { ms, id: newId('n') }; });
  const byId = [...made].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((x) => x.ms);
  const byTime = [...made].sort((a, b) => a.ms - b.ms).map((x) => x.ms);
  assert.deepEqual(byId, byTime);
});

// ---------- Record defaults ----------
// Frozen all the way down: a spread copies the array REFERENCE, so an unfrozen tags: [] would let
// one note's push leak into every later note.
test('record defaults are frozen, arrays included', () => {
  for (const d of [NOTE_DEFAULTS, TOPIC_DEFAULTS, TAG_DEFAULTS]) assert.ok(Object.isFrozen(d));
  for (const k of ['tags', 'verses', 'verseKeys']) {
    assert.ok(Object.isFrozen(NOTE_DEFAULTS[k]), k);
    assert.throws(() => NOTE_DEFAULTS[k].push('x'), TypeError, k);
  }
});

test('a spread copy is a normal, writable record', () => {
  const note = { ...NOTE_DEFAULTS, title: 'Passover' };
  note.pinned = true;
  assert.equal(note.title, 'Passover');
  assert.equal(note.topicId, null); // Uncategorized
  assert.deepEqual(note.tags, []);
});

test('defaults carry no id, timestamps or source', () => {
  for (const k of ['id', 'createdAt', 'updatedAt', 'source']) {
    assert.ok(!(k in NOTE_DEFAULTS), k);
  }
});
