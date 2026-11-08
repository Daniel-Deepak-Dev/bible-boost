/*
 * BibleBoost — migration ladder
 * How the database gets from whatever version is on disk to the one this build expects. db.js runs
 * this inside IndexedDB's onupgradeneeded and owns all the event handling; this file only says what
 * each version looks like.
 *
 * Everything it touches arrives as an argument, with no indexedDB global and no chrome.*, because
 * Node has no IndexedDB and a library that fakes one is a dependency this project does not take.
 * test/migrate.test.js drives it with a small fake that records the calls.
 *
 * The ladder has one rung today. It is here anyway because it cannot be added later: by the time a
 * second version is needed, users already have data at the first (T-003).
 */
import { SCHEMA_VERSION } from '../shared/schema.js';

// ---------- Errors ----------
// Exported so that db.js gives the same answer for both ways a newer database can show up (see
// checkStoredVersion below). Worded for the person reading it, because it reaches the UI unchanged
// through the router's { ok: false, error }.
export const NEWER_DB_ERROR = 'Your notes were saved by a newer version of BibleBoost. Update the extension to open them. Nothing has been changed.';

// ---------- Steps ----------
// Version 1, exactly as work/understandings/extension/02-storage-model.md specifies it.
//
// A null is not a valid IndexedDB key, so a record whose indexed field is null is simply left out
// of that index, with no error. byDeleted therefore holds only trashed notes, which is what a Trash
// list wants, but byTopic cannot find the Uncategorized notes (topicId: null) and byParent cannot
// find the root topics. T-005 has to reach those another way.
//
// multiEntry on byTag and byVerse indexes each array element separately. Without it the whole array
// becomes one compound key, and looking up a single tag finds nothing.
function createEverything(db) {
  const notes = db.createObjectStore('notes', { keyPath: 'id' });
  notes.createIndex('byUpdated', 'updatedAt');
  notes.createIndex('byTopic', 'topicId');
  notes.createIndex('byTag', 'tags', { multiEntry: true });
  notes.createIndex('byVerse', 'verseKeys', { multiEntry: true });
  notes.createIndex('byDeleted', 'deletedAt');

  const topics = db.createObjectStore('topics', { keyPath: 'id' });
  topics.createIndex('byParent', 'parentId');
  topics.createIndex('byOrder', 'order');

  db.createObjectStore('tags', { keyPath: 'name' });
  db.createObjectStore('meta', { keyPath: 'key' });
}

// STEPS[n] takes the database from version n to version n + 1, so version 1 is STEPS[0] and there
// is always exactly one step per version, which test/migrate.test.js checks against SCHEMA_VERSION.
//
// The next schema change is one new function appended here and a bump of SCHEMA_VERSION. Never edit
// a step that has shipped: it has already run on someone's data, and an edit reaches only the people
// who install after it, so two users on the same version would end up with different databases.
export const STEPS = Object.freeze([
  createEverything,
]);

// ---------- Running the ladder ----------
// Runs every step between the version on disk and the current one, in order, inside the upgrade
// transaction. oldVersion is 0 for a database that did not exist yet. steps is a parameter only so
// the test can run a ladder longer than today's single rung.
//
// The meta row is written in that same transaction so it can never disagree with the structure. If
// any step throws, db.js aborts, and IndexedDB rolls back the stores and the row together, leaving
// the previous version intact for the next try.
export function runLadder(db, tx, oldVersion, steps = STEPS) {
  for (let v = oldVersion; v < steps.length; v++) steps[v](db, tx);
  tx.objectStore('meta').put({ key: 'schemaVersion', value: SCHEMA_VERSION });
}

// ---------- Reading the version back ----------
// Runs on every open (T-003 R4), because an older build must not write to a database that a newer
// build has reshaped.
//
// A newer database usually never reaches this check. Opening at a lower version than the one on
// disk fails with VersionError before any code can read meta, and db.js maps that to the same
// message. This covers what IndexedDB cannot see: a meta row that disagrees with the structure,
// which is how a restored or hand-edited database would look.
//
// Anything else that is not the current version, a missing row included, cannot come from runLadder
// and means the database is damaged. Refusing is safer than writing a version that may be a lie.
export function checkStoredVersion(stored) {
  if (stored > SCHEMA_VERSION) throw new Error(NEWER_DB_ERROR);
  if (stored !== SCHEMA_VERSION) throw new Error(`The notes database has an unexpected schema version (${stored}).`);
}
