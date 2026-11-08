/*
 * BibleBoost — record schema
 * The one definition of what a stored record looks like: the schema version, the id generator and
 * the defaults every new record starts from. work/understandings/extension/02-storage-model.md is
 * the normative description; this file is that description as code, and the two must agree.
 *
 * Only the service worker imports this (architecture rule 1). Content scripts are classic scripts
 * and cannot import an ES module anyway, which is the point: they send raw drafts, and the worker
 * gives them ids and defaults, so there is exactly one place where a note becomes valid.
 *
 * Nothing in here may touch chrome.* or the DOM. The file has to load in plain Node so that
 * `node --test` can cover it (T-007 R3). The single global it uses, crypto.randomUUID, exists
 * in a service worker and in Node 19 and later.
 */

// ---------- Version ----------
// Written into the meta store on first open and read back on every open (T-003 R4). Bump it only
// together with a new step in the migration ladder, never on its own.
export const SCHEMA_VERSION = 1;

// ---------- Ids ----------
// 'n_' + base-36 milliseconds + 8 hex characters of a random UUID, e.g. "n_mw6y1iw4" + "3f9a0c12".
//
// Sortable by creation time, which is what makes it worth more than a bare UUID: Date.now() in base
// 36 has been exactly 8 characters since 1972-06-25 and stays 8 until 2059-05-25 (36^8 ms), so
// comparing two ids as plain strings compares their creation times, and a list keyed by id comes
// out of IndexedDB oldest first with no extra index. Two ids made in the SAME millisecond are
// ordered by their random tail, i.e. not at all, which is fine for notes created by hand.
//
// The 8 hex characters are 32 random bits, and they only have to separate ids made in the same
// millisecond. That is a collision chance of about 1 in 4 billion per pair, at a rate no human
// clicking "save" can reach.
//
// Ids are generated here and nowhere else (02-storage-model.md, "Id generation").
export const newId = (p) => p + '_' + Date.now().toString(36) + crypto.randomUUID().slice(0, 8);

// ---------- Record defaults ----------
// What a record holds before anyone has said otherwise. A creating handler spreads one of these
// first and the validated draft over it: { ...NOTE_DEFAULTS, ...clean, id, createdAt, updatedAt }.
//
// Frozen all the way down, arrays included. A spread copies the REFERENCE to tags: [], so without
// the freeze one careless note.tags.push() would put that tag into every note created afterwards,
// a bug that shows up far from its cause. Frozen, the same push throws a TypeError at the line
// that did it, because modules are always strict.
//
// Deliberately missing: id, createdAt, updatedAt (stamped at creation), source (the caller says
// where the note came from), and a topic's name / slug or a tag's label (the user's own words).
// A default for any of those would only hide a draft that forgot to send one.
export const NOTE_DEFAULTS = Object.freeze({
  title: '',
  body: '',
  topicId: null, // null is "Uncategorized"; there is no such topic row (T-003 R8)
  tags: Object.freeze([]),
  verses: Object.freeze([]),
  verseKeys: Object.freeze([]), // derived from verses, in one function, by T-005
  color: null,
  pinned: false,
  deletedAt: null, // soft delete: set means "in Trash"
});

export const TOPIC_DEFAULTS = Object.freeze({
  parentId: null, // in the schema from day one so nesting later is not a migration
  color: null,
  order: 0,
  deletedAt: null,
});

export const TAG_DEFAULTS = Object.freeze({
  color: null,
});
