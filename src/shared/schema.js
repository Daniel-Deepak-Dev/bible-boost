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
import { compareUsfm } from './refs.js';

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
// now is a parameter so a record's id and its createdAt can come from one clock reading. Reading
// the clock twice put them up to 1 ms apart in T-005's run against real IndexedDB, which was enough
// for key order to disagree with createdAt on notes made back to back, and repo.js relies on the
// two agreeing when it sorts by created date.
//
// Ids are generated here and nowhere else (02-storage-model.md, "Id generation").
export const newId = (p, now = Date.now()) => p + '_' + now.toString(36) + crypto.randomUUID().slice(0, 8);

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

// ---------- Allowed values ----------
// Where a note was made. There is no default, for the reason given at NOTE_DEFAULTS above.
export const NOTE_SOURCES = Object.freeze(['menu', 'panel', 'page', 'import']);

// What happens to the notes of a deleted topic. Required, with no fallback anywhere that reads it:
// a destructive operation that guesses is how notes vanish two surfaces later (T-032 R7). T-032
// adds 'move' along with the target topic it needs.
export const TOPIC_DELETE_STRATEGIES = Object.freeze(['reassign', 'trash']);

// The three timestamp columns, which is every sort T-005 needs. T-028 adds verse, title and topic.
export const NOTE_SORT_FIELDS = Object.freeze(['updatedAt', 'createdAt', 'deletedAt']);

// A page of notes goes back through sendResponse as JSON, verse text included. 100 is a screenful
// several times over, and the cap stops one careless call from serializing the whole collection.
// `total` in the reply always says how much there was, so a short page cannot look like lost notes.
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 500;

// ---------- Comparing text ----------
// The one definition of "the same tag" (T-005 R2), and the order the two steps run in is part of
// it. NFC comes first because the same Tamil vowel sign can arrive composed (U+0BCA) or as two code
// points (U+0BC6 U+0BBE), and those compare unequal however they are cased. toLocaleLowerCase, never
// toLowerCase, which looks identical in English testing and diverges elsewhere.
//
// Anything that is not a string normalizes to '', which every caller treats as "no tag".
export const normalizeTag = (raw) => (typeof raw === 'string' ? raw.trim().normalize('NFC').toLocaleLowerCase() : '');

// A plain < puts every Tamil tag in a block by code point, away from the English ones. numeric makes
// "psalm 9" come before "psalm 10". sensitivity: 'base' can call two different strings equal, so the
// code-point tiebreak is what makes the result depend only on the set of tags and never on the order
// they were typed in.
const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const compareText = (a, b) => COLLATOR.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);

// ---------- Checking a value's type ----------
// Drafts come from content scripts now and imported files later, so nothing about their shape can
// be assumed (architecture rule 2). Each message reaches the UI unchanged through the router's
// { ok: false, error }, so it is worded for the person reading it.
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function text(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  return value;
}

const textOrNull = (value, label) => (value === null ? null : text(value, label));

// Ids go straight into IndexedDB, where a value that is not a valid key throws a DataError that
// tells the user nothing. Only the shape is checked here; whether the record exists is repo.js's.
export function cleanId(id) {
  if (typeof id !== 'string' || !id) throw new Error('That id is not valid.');
  return id;
}

// Empty is an error rather than a quiet no-op: a bulk action with nothing selected is a bug in the
// surface that sent it, and it is better found than absorbed.
export function cleanIds(ids) {
  if (!Array.isArray(ids) || !ids.length) throw new Error('No notes were given.');
  return [...new Set(ids.map(cleanId))];
}

// ---------- Tags ----------
// The label is what the user typed, NFC but otherwise untouched. When one list spells a tag several
// ways, Faith, faith and FAITH, the first spelling is the one kept.
//
// A blank entry is dropped, because "faith, , hope" is an ordinary thing to type. A non-string is
// refused, because no text field can produce one, so it can only be a bug in the caller.
export function cleanTags(raw) {
  if (!Array.isArray(raw)) throw new Error('Tags must be a list.');
  const seen = new Map();
  for (const tag of raw) {
    const name = normalizeTag(text(tag, 'A tag'));
    if (name && !seen.has(name)) seen.set(name, tag.trim().normalize('NFC'));
  }
  return [...seen].map(([name, label]) => ({ name, label })).sort((a, b) => compareText(a.name, b.name));
}

export function cleanTagEntry(raw) {
  const [entry] = cleanTags([raw]);
  if (!entry) throw new Error('A tag needs a name.');
  return entry;
}

// Swaps tags on a note for tag rename, merge (several sources) and delete (no target). The target
// goes on only if a source was really there, and the Set is what collapses a merge on a note that
// already carried the target.
export function retag(tags, sources, target) {
  const kept = tags.filter((t) => !sources.includes(t));
  if (target !== undefined && kept.length < tags.length) kept.push(target);
  return [...new Set(kept)].sort(compareText);
}

// ---------- Verses ----------
// The same shape BB.dom's REF_RE accepts for a chapter, plus the verse, and that is what rejects a
// book intro such as JHN.INTRO1. Digits only: 02-verse-dom.md documents BOOK.chapter.verse and
// nothing else, and a capture that does not fit should fail where it can be seen.
const USFM_RE = /^([A-Z0-9]{3})\.(\d+)\.(\d+)$/;
const CHAPTER_RE = /^[A-Z0-9]{3}\.\d+$/;

// bible.com can write a combined verse as "JHN.1.1+JHN.1.2" in data-usfm, and the rule everywhere
// is to take the part before the plus (02-verse-dom.md).
function cleanUsfm(raw) {
  const usfm = text(raw, 'A verse reference').split('+')[0];
  if (!USFM_RE.test(usfm)) throw new Error(`"${raw}" is not a verse reference.`);
  return usfm;
}

// One version's side of a verse. Only the four known fields are copied, so a page-side object
// cannot carry anything else into a stored record.
function cleanSide(side, usfm, which) {
  if (!isRecord(side)) throw new Error(`Verse ${usfm} has no ${which} text.`);
  return {
    versionId: text(side.versionId ?? '', 'A version id'),
    abbr: text(side.abbr ?? '', 'A version abbreviation'),
    lang: text(side.lang ?? '', 'A version language'),
    text: text(side.text, 'Verse text'),
  };
}

// book, chapter and verse are worked out here from usfm and never read from the draft, so the
// structured fields cannot disagree with the key the note is found by.
//
// A malformed verse refuses the whole draft rather than being dropped. The stored pair of texts IS
// the note (02-storage-model.md), so a note silently missing one of its verses is worse than a save
// that fails and says why.
function cleanVerse(raw) {
  if (!isRecord(raw)) throw new Error('A verse is missing its reference.');
  const usfm = cleanUsfm(raw.usfm);
  const [book, chapter, verse] = usfm.split('.');
  return {
    usfm,
    book,
    chapter: Number(chapter),
    verse: Number(verse),
    displayRef: text(raw.displayRef ?? '', 'A display reference'),
    primary: cleanSide(raw.primary, usfm, 'primary'),
    parallel: raw.parallel == null ? null : cleanSide(raw.parallel, usfm, 'parallel'),
  };
}

// R3: the ONLY place verseKeys comes from. They duplicate verses because a multiEntry index needs a
// flat array of scalars, and drift between the two would silently break verse lookup. A note is
// found by a verse once however often that verse appears in it.
export const deriveVerseKeys = (verses) => [...new Set(verses.map((v) => v.usfm))];

// ---------- Notes ----------
// Copies only the fields a caller may set, and only the ones it actually sent, which is what makes
// one function right for both a whole draft and a partial patch. Everything else that might be on
// the object (id, createdAt, deletedAt, verseKeys, or a whole note sent back as a patch) is ignored,
// so those stay the worker's to decide.
//
// Being the one caller of deriveVerseKeys here is how create and update stay in step (R3).
//
// Verses are put in canonical order here, ahead of that call, so that verses and verseKeys agree and
// every way of writing a note gets the same order (T-016 R4). It is here and not in the content script
// because compareUsfm is in an ES module, which a classic script cannot import.
//
// topicId is passed through unchecked. Whether it names a real topic needs the database, so
// repo.js settles it inside the transaction (R2).
function cleanNoteFields(raw) {
  const fields = {};
  let tagEntries = [];
  if (raw.title !== undefined) fields.title = text(raw.title, 'A title');
  if (raw.body !== undefined) fields.body = text(raw.body, 'A note body');
  if (raw.topicId !== undefined) fields.topicId = raw.topicId;
  if (raw.color !== undefined) fields.color = textOrNull(raw.color, 'A colour');
  if (raw.pinned !== undefined) {
    if (typeof raw.pinned !== 'boolean') throw new Error('Pinned must be true or false.');
    fields.pinned = raw.pinned;
  }
  if (raw.tags !== undefined) {
    tagEntries = cleanTags(raw.tags);
    fields.tags = tagEntries.map((t) => t.name);
  }
  if (raw.verses !== undefined) {
    if (!Array.isArray(raw.verses)) throw new Error('Verses must be a list.');
    fields.verses = raw.verses.map(cleanVerse).sort((a, b) => compareUsfm(a.usfm, b.usfm));
    fields.verseKeys = deriveVerseKeys(fields.verses);
  }
  return { fields, tagEntries };
}

// A blank body counts as no body, in every script, because trim() knows Unicode whitespace.
//
// The empty test applies to creating and not to updating (T-005 R2 and R4). It was written for
// T-022's first autosave, which sent a patch mid-retype. That is gone (the panel saves on Save
// since 2026-11-12), and the rule stays: an update that empties a body is the user's decision, and
// the note keeps its verse or its title.
export function cleanNoteDraft(draft) {
  if (!isRecord(draft)) throw new Error('A note draft must be an object.');
  const { fields, tagEntries } = cleanNoteFields(draft);
  if (!fields.verses?.length && !fields.body?.trim()) throw new Error('A note needs at least a verse or some text.');
  if (!NOTE_SOURCES.includes(draft.source)) throw new Error('A note must say where it came from: menu, panel, page or import.');
  return { fields: { ...fields, source: draft.source }, tagEntries };
}

export function cleanNotePatch(patch) {
  if (!isRecord(patch)) throw new Error('A note update must be an object.');
  return cleanNoteFields(patch);
}

// ---------- Listing ----------
// topicId keeps the difference that matters: undefined means "any topic" and null means
// Uncategorized. The tag is normalized here, so looking one up by its label, or by a decomposed
// spelling of a Tamil tag, finds it.
export function cleanNoteFilter(raw) {
  if (raw === undefined || raw === null) return { trashed: false };
  if (!isRecord(raw)) throw new Error('A note filter must be an object.');
  const filter = { trashed: raw.trashed === true };
  if (raw.topicId !== undefined) filter.topicId = raw.topicId === null ? null : cleanId(raw.topicId);
  if (raw.tag !== undefined) {
    filter.tag = normalizeTag(raw.tag);
    if (!filter.tag) throw new Error('A tag filter needs a tag.');
  }
  if (raw.verseKey !== undefined) filter.verseKey = cleanUsfm(raw.verseKey);
  if (raw.chapter !== undefined) {
    if (typeof raw.chapter !== 'string' || !CHAPTER_RE.test(raw.chapter)) throw new Error(`"${raw.chapter}" is not a chapter reference.`);
    filter.chapter = raw.chapter;
  }
  for (const end of ['from', 'to']) {
    if (raw[end] === undefined) continue;
    if (!Number.isFinite(raw[end])) throw new Error('A date filter must be a timestamp.');
    filter[end] = raw[end];
  }
  // IDBKeyRange.bound throws a DataError for this, which would reach the user as gibberish.
  if (filter.from > filter.to) throw new Error('That date range ends before it starts.');
  return filter;
}

// Newest first by default, because the panel opens on "what was I just doing" (T-021 R8). Trash
// defaults to most recently deleted (T-034 R1). Every live note has deletedAt null, so sorting them
// by it is meaningless, and asking for that is refused rather than answered in an arbitrary order.
export function cleanNoteSort(raw, filter) {
  const by = raw?.by ?? (filter.trashed ? 'deletedAt' : 'updatedAt');
  const dir = raw?.dir ?? 'desc';
  if (!NOTE_SORT_FIELDS.includes(by)) throw new Error(`Notes cannot be sorted by ${by}.`);
  if (dir !== 'asc' && dir !== 'desc') throw new Error('Sort direction must be asc or desc.');
  if (by === 'deletedAt' && !filter.trashed) throw new Error('Only Trash can be sorted by deletion date.');
  return { by, dir };
}

// limit: 0 is allowed on purpose, so a surface can ask only for `total` (T-023's per-scope counts).
export function cleanPage(raw) {
  const offset = Number.isInteger(raw?.offset) && raw.offset > 0 ? raw.offset : 0;
  const limit = Number.isInteger(raw?.limit) && raw.limit >= 0 ? Math.min(raw.limit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  return { offset, limit };
}

// ---------- Topics ----------
// Unicode classes, never \w, or a Tamil name would be stripped to nothing. Marks are deliberately
// kept: Tamil vowel signs are \p{M}, and removing them changes the word.
export const slugify = (name) => name.normalize('NFC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '-').replace(/^-+|-+$/g, '');

function cleanTopicName(raw) {
  const name = text(raw, 'A topic name').trim().normalize('NFC');
  if (!name) throw new Error('A topic needs a name.');
  return name;
}

// parentId is passed through like a note's topicId: repo.js settles it against the database.
export function cleanTopicDraft(draft) {
  if (!isRecord(draft)) throw new Error('A topic must be an object.');
  const name = cleanTopicName(draft.name);
  const fields = { name, slug: slugify(name) };
  if (draft.color !== undefined) fields.color = textOrNull(draft.color, 'A colour');
  if (draft.parentId !== undefined) fields.parentId = draft.parentId;
  return fields;
}

export function cleanTopicPatch(patch) {
  if (!isRecord(patch)) throw new Error('A topic update must be an object.');
  const fields = {};
  if (patch.name !== undefined) {
    fields.name = cleanTopicName(patch.name);
    fields.slug = slugify(fields.name);
  }
  if (patch.color !== undefined) fields.color = textOrNull(patch.color, 'A colour');
  if (patch.parentId !== undefined) fields.parentId = patch.parentId;
  if (patch.order !== undefined) {
    if (!Number.isFinite(patch.order)) throw new Error('A topic order must be a number.');
    fields.order = patch.order;
  }
  return fields;
}
