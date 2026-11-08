/*
 * src/background/migrate.js — the schema ladder and the refuse-on-newer rule.
 *
 * A fake database records what the ladder asks for, because Node has no IndexedDB and a library
 * that fakes one is a dependency this project does not take. So these tests prove the ladder asks
 * for the right things in the right order. Whether real IndexedDB does them is T-003's acceptance
 * list, by hand. Schema mistakes become migrations later, which is what makes this worth checking.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION } from '../src/shared/schema.js';
import { STEPS, NEWER_DB_ERROR, runLadder, checkStoredVersion } from '../src/background/migrate.js';

function fakeDb() {
  const stores = new Map();
  const db = {
    createObjectStore(name, { keyPath }) {
      assert.ok(!stores.has(name), `${name} created twice`);
      const indexes = {};
      const rows = [];
      const store = {
        keyPath, indexes, rows,
        createIndex(index, path, opts = {}) { indexes[index] = { path, multiEntry: !!opts.multiEntry }; },
        put(row) { rows.push(row); },
      };
      stores.set(name, store);
      return store;
    },
  };
  const tx = { objectStore: (name) => stores.get(name) ?? assert.fail(`no store named ${name}`) };
  return { db, tx, stores };
}

const fromEmpty = () => {
  const fake = fakeDb();
  runLadder(fake.db, fake.tx, 0);
  return fake.stores;
};

const single = (path) => ({ path, multiEntry: false });
const multi = (path) => ({ path, multiEntry: true });

// ---------- The ladder's shape (R3) ----------
test('there is exactly one step per schema version', () => {
  assert.equal(STEPS.length, SCHEMA_VERSION);
});

test('every step is a named function', () => {
  for (const step of STEPS) {
    assert.equal(typeof step, 'function');
    assert.ok(step.name, 'an anonymous step is one nobody can find in a stack trace');
  }
});

test('the ladder cannot be edited at runtime', () => {
  assert.ok(Object.isFrozen(STEPS));
});

// ---------- From empty to version 1 (R2) ----------
// The normative list from 02-storage-model.md, spelled out again on purpose: a change to the schema
// has to change this too, which is the moment to ask whether it needed a new step instead.
test('from empty, the stores are exactly the specified four', () => {
  assert.deepEqual([...fromEmpty().keys()].sort(), ['meta', 'notes', 'tags', 'topics']);
});

test('each store has its specified key path', () => {
  const stores = fromEmpty();
  assert.equal(stores.get('notes').keyPath, 'id');
  assert.equal(stores.get('topics').keyPath, 'id');
  assert.equal(stores.get('tags').keyPath, 'name');
  assert.equal(stores.get('meta').keyPath, 'key');
});

test('notes has its five indexes, with tags and verses multiEntry', () => {
  assert.deepEqual(fromEmpty().get('notes').indexes, {
    byUpdated: single('updatedAt'),
    byTopic: single('topicId'),
    byTag: multi('tags'),
    byVerse: multi('verseKeys'),
    byDeleted: single('deletedAt'),
  });
});

test('topics has its two indexes, and tags and meta have none', () => {
  const stores = fromEmpty();
  assert.deepEqual(stores.get('topics').indexes, { byParent: single('parentId'), byOrder: single('order') });
  assert.deepEqual(stores.get('tags').indexes, {});
  assert.deepEqual(stores.get('meta').indexes, {});
});

// ---------- The meta row (R4) and seeding (R8) ----------
test('the schema version is written into meta', () => {
  assert.deepEqual(fromEmpty().get('meta').rows, [{ key: 'schemaVersion', value: SCHEMA_VERSION }]);
});

// "Uncategorized" is topicId: null. A real row would be one import, export and delete all have to
// know about.
test('nothing else is seeded', () => {
  const stores = fromEmpty();
  for (const name of ['notes', 'topics', 'tags']) assert.deepEqual(stores.get(name).rows, [], name);
});

// ---------- Which steps run ----------
// Today's ladder has one rung, so these use a longer one to prove the climb itself.
function climb(oldVersion) {
  const fake = fakeDb();
  fake.db.createObjectStore('meta', { keyPath: 'key' });
  const ran = [];
  const steps = [() => ran.push('v1'), () => ran.push('v2'), () => ran.push('v3')];
  runLadder(fake.db, fake.tx, oldVersion, steps);
  return ran;
}

test('from empty every step runs, in order', () => {
  assert.deepEqual(climb(0), ['v1', 'v2', 'v3']);
});

test('only the steps above the version on disk run', () => {
  assert.deepEqual(climb(1), ['v2', 'v3']);
  assert.deepEqual(climb(2), ['v3']);
});

test('a database already at the top runs no step', () => {
  assert.deepEqual(climb(3), []);
});

test('a step gets both the database and the upgrade transaction', () => {
  const fake = fakeDb();
  fake.db.createObjectStore('meta', { keyPath: 'key' });
  let got = null;
  runLadder(fake.db, fake.tx, 0, [(db, tx) => { got = { db, tx }; }]);
  assert.equal(got.db, fake.db);
  assert.equal(got.tx, fake.tx);
});

// A step that throws must not be followed by a meta write: db.js aborts on the throw, and a version
// recorded for an upgrade that failed would be a lie.
test('a step that throws stops the climb and writes no version', () => {
  const fake = fakeDb();
  const meta = fake.db.createObjectStore('meta', { keyPath: 'key' });
  let later = false;
  const steps = [() => { throw new Error('bad step'); }, () => { later = true; }];
  assert.throws(() => runLadder(fake.db, fake.tx, 0, steps), /bad step/);
  assert.equal(later, false);
  assert.deepEqual(meta.rows, []);
});

// ---------- Refusing a newer database (R4) ----------
test('the current version is accepted', () => {
  assert.doesNotThrow(() => checkStoredVersion(SCHEMA_VERSION));
});

test('a newer version is refused with the message the user sees', () => {
  assert.throws(() => checkStoredVersion(SCHEMA_VERSION + 1), { message: NEWER_DB_ERROR });
});

test('an older or missing version is refused as damage, not as newer', () => {
  for (const stored of [SCHEMA_VERSION - 1, undefined, null, '1']) {
    assert.throws(() => checkStoredVersion(stored), /unexpected schema version/, String(stored));
  }
});
