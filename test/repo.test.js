/*
 * src/background/repo.js — the parts that need no database: which index a query reads, what a query
 * matches, and the change signal.
 *
 * Node has no IndexedDB and a library that fakes one is a dependency this project does not take, so
 * the transactions themselves are T-005's acceptance list, by hand. What can be proven here is that
 * they cannot be bypassed: see "the one way to write" below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanNoteFilter, cleanNoteSort } from '../src/shared/schema.js';
import { planNoteQuery, noteMatches, noteComparator, bumpRev } from '../src/background/repo.js';

const plan = (filter, sort) => {
  const f = cleanNoteFilter(filter);
  return planNoteQuery(f, cleanNoteSort(sort, f));
};

// ---------- Which index (R6) ----------
test('the default list walks byUpdated newest first and can stop at the page', () => {
  assert.deepEqual(plan(), { index: 'byUpdated', range: null, ordered: true, countable: true, direction: 'prev' });
});

test('ascending walks the other way', () => {
  assert.equal(plan(undefined, { by: 'updatedAt', dir: 'asc' }).direction, 'next');
});

test('topic, tag and verse each use their own index, for one key', () => {
  assert.deepEqual(plan({ topicId: 't_1' }).range, { only: 't_1' });
  assert.equal(plan({ topicId: 't_1' }).index, 'byTopic');
  assert.deepEqual(plan({ tag: 'Faith' }).range, { only: 'faith' });
  assert.equal(plan({ tag: 'Faith' }).index, 'byTag');
  assert.deepEqual(plan({ verseKey: 'EXO.13.2' }).range, { only: 'EXO.13.2' });
  assert.equal(plan({ verseKey: 'EXO.13.2' }).index, 'byVerse');
});

// The trailing dot is the whole point: a bare 'EXO.1' prefix would also take in EXO.13.2.
test('a chapter is a prefix range on byVerse that cannot reach the next chapter number', () => {
  const p = plan({ chapter: 'EXO.1' });
  assert.equal(p.index, 'byVerse');
  assert.equal(p.range.lower, 'EXO.1.');
  assert.ok(p.range.upper > 'EXO.1.176');
  assert.ok(!('EXO.13.2' >= p.range.lower && 'EXO.13.2' <= p.range.upper), 'EXO.13.2 is not in EXO.1');
});

// byTopic cannot find these: a null is not a valid key, so the row is not in the index at all.
test('Uncategorized cannot use byTopic and walks byUpdated, counting as it goes', () => {
  const p = plan({ topicId: null });
  assert.equal(p.index, 'byUpdated');
  assert.equal(p.ordered, true);
  assert.equal(p.countable, false);
});

test('Trash reads byDeleted, most recently deleted first', () => {
  assert.deepEqual(plan({ trashed: true }), { index: 'byDeleted', range: null, ordered: true, countable: true, direction: 'prev' });
});

test('a date range is a range on byUpdated, open at either end', () => {
  assert.deepEqual(plan({ from: 5, to: 9 }).range, { lower: 5, upper: 9 });
  assert.deepEqual(plan({ from: 5 }).range, { lower: 5, upper: undefined });
  assert.equal(plan({ from: 5 }).index, 'byUpdated');
  assert.equal(plan({ from: 5 }).countable, false);
});

test('sorting by created date walks the store itself, whose keys are in creation order', () => {
  const p = plan(undefined, { by: 'createdAt', dir: 'asc' });
  assert.equal(p.index, null);
  assert.equal(p.ordered, true);
});

test('combined filters take the narrowest index and leave the rest to noteMatches', () => {
  assert.equal(plan({ verseKey: 'EXO.13.2', tag: 'faith', topicId: 't_1' }).index, 'byVerse');
  assert.equal(plan({ tag: 'faith', topicId: 't_1' }).index, 'byTag');
  assert.equal(plan({ tag: 'faith', trashed: true }).index, 'byTag');
});

test('a narrow query is sorted in memory, because its index is in the wrong order', () => {
  for (const filter of [{ tag: 'x' }, { topicId: 't_1' }, { chapter: 'EXO.13' }]) assert.equal(plan(filter).ordered, false);
});

// ---------- What matches ----------
const NOTE = Object.freeze({
  id: 'n_1', topicId: 't_1', tags: ['faith', 'exodus'], verseKeys: ['EXO.13.2', 'EXO.13.3'], updatedAt: 100, deletedAt: null,
});
const matches = (filter, note = NOTE) => noteMatches(note, cleanNoteFilter(filter));

test('a live note is in the default list and not in Trash', () => {
  assert.equal(matches(undefined), true);
  assert.equal(matches({ trashed: true }), false);
});

test('a trashed note is in Trash and not in the default list', () => {
  const trashed = { ...NOTE, deletedAt: 5 };
  assert.equal(matches(undefined, trashed), false);
  assert.equal(matches({ trashed: true }, trashed), true);
});

test('null means Uncategorized, undefined means any topic', () => {
  const none = { ...NOTE, topicId: null };
  assert.equal(matches({ topicId: null }, none), true);
  assert.equal(matches({ topicId: null }), false);
  assert.equal(matches({ topicId: 't_1' }), true);
  assert.equal(matches({ topicId: 't_2' }), false);
  assert.equal(matches({}, none), true);
});

test('tag and verse match on the element, not the array', () => {
  assert.equal(matches({ tag: 'FAITH' }), true);
  assert.equal(matches({ tag: 'hope' }), false);
  assert.equal(matches({ verseKey: 'EXO.13.3' }), true);
  assert.equal(matches({ verseKey: 'EXO.13.4' }), false);
});

test('a chapter matches any verse in it, and not a chapter sharing its digits', () => {
  assert.equal(matches({ chapter: 'EXO.13' }), true);
  assert.equal(matches({ chapter: 'EXO.1' }), false);
  assert.equal(matches({ chapter: 'GEN.13' }), false);
});

test('a date range includes both ends', () => {
  assert.equal(matches({ from: 100, to: 100 }), true);
  assert.equal(matches({ from: 101 }), false);
  assert.equal(matches({ to: 99 }), false);
});

test('every filter must agree', () => {
  assert.equal(matches({ tag: 'faith', topicId: 't_2' }), false);
  assert.equal(matches({ tag: 'faith', topicId: 't_1', chapter: 'EXO.13' }), true);
});

// ---------- Ordering ----------
test('the comparator sorts in both directions and breaks ties by id', () => {
  const a = { id: 'n_a', updatedAt: 1 };
  const b = { id: 'n_b', updatedAt: 2 };
  const c = { id: 'n_c', updatedAt: 2 };
  const by = (dir) => [a, c, b].sort(noteComparator({ by: 'updatedAt', dir })).map((n) => n.id);
  assert.deepEqual(by('asc'), ['n_a', 'n_b', 'n_c']);
  assert.deepEqual(by('desc'), ['n_c', 'n_b', 'n_a']);
});

// ---------- The one way to write (R7, R8) ----------
// Every write has to go through mutate(), because that is the only thing that gives it one
// transaction and exactly one bump after commit. A second readwrite in this file is a write that
// forgot one or both, which reads later as a CRUD bug and is very hard to trace.
test('repo.js opens a readwrite transaction in exactly one place', () => {
  const source = readFileSync(new URL('../src/background/repo.js', import.meta.url), 'utf8');
  const code = source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(code.match(/'readwrite'/g)?.length, 1);
  assert.equal(code.match(/bumpRev\(/g)?.length, 2, 'its definition, and the one call in mutate()');
});

// ---------- bumpRev (R7) ----------
function fakeStorage(t, { failSet = false } = {}) {
  const data = {};
  const writes = [];
  t.mock.method(console, 'error', () => {});
  globalThis.chrome = {
    storage: {
      local: {
        // Every call really yields, so two bumps overlapping would interleave if they could.
        get: async (key) => { await new Promise((r) => setTimeout(r, 1)); return key in data ? { [key]: data[key] } : {}; },
        set: async (obj) => {
          await new Promise((r) => setTimeout(r, 1));
          if (failSet) throw new Error('quota');
          Object.assign(data, obj);
          writes.push(obj);
        },
      },
    },
  };
  t.after(() => { delete globalThis.chrome; });
  return { data, writes };
}

test('a bump writes the counter, the ids and the kind', async (t) => {
  const { data } = fakeStorage(t);
  await bumpRev('update', ['n_1']);
  assert.deepEqual(data, { notesRev: 1, notesRevIds: ['n_1'], notesRevKind: 'update' });
});

// Unguarded, both would read 0 and both write 1, and a listener on changes.notesRev would hear once.
test('bumps that overlap still each increment the counter', async (t) => {
  const { data, writes } = fakeStorage(t);
  await Promise.all([bumpRev('create', ['a']), bumpRev('update', ['b']), bumpRev('trash', ['c'])]);
  assert.equal(data.notesRev, 3);
  assert.deepEqual(writes.map((w) => w.notesRev), [1, 2, 3]);
  assert.deepEqual(writes.map((w) => w.notesRevKind), ['create', 'update', 'trash']);
});

// The data has already committed by then, so the caller must not be told it failed.
test('a bump that cannot write does not reject, and is logged', async (t) => {
  fakeStorage(t, { failSet: true });
  await assert.doesNotReject(bumpRev('create', ['a']));
  assert.equal(console.error.mock.callCount(), 1);
});

test('a failed bump does not stop later ones', async (t) => {
  const first = fakeStorage(t, { failSet: true });
  await bumpRev('create', ['a']);
  assert.deepEqual(first.writes, []);
  const second = fakeStorage(t);
  await bumpRev('update', ['b']);
  assert.equal(second.data.notesRev, 1);
});
