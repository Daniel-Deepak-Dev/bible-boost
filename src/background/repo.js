/*
 * BibleBoost — repository
 * The single authority over notes, topics and tags (T-005). Every surface, the save popover, the
 * panel, the full page and import, reads and writes through these functions and nowhere else, so
 * there is one validator, one id generator, one place verseKeys is kept in step with verses, and one
 * place the change counter moves. If a surface needs a new query, it belongs here.
 *
 * Validation happens before any transaction opens: the cleaners in schema.js are synchronous and
 * throw, so a bad draft costs nothing and cannot leave a transaction half used. Whether a topic
 * exists needs the database, and that one check runs inside the transaction that depends on it.
 *
 * Everything that does not need a database is exported and pure, because Node has no IndexedDB and
 * a library that fakes one is a dependency this project does not take. test/repo.test.js covers
 * those parts, and T-005's acceptance list covers the rest by hand.
 */
import {
  NOTE_DEFAULTS, TOPIC_DEFAULTS, TAG_DEFAULTS, TOPIC_DELETE_STRATEGIES,
  newId, normalizeTag, compareText, retag, cleanId, cleanIds,
  cleanNoteDraft, cleanNotePatch, cleanNoteFilter, cleanNoteSort, cleanPage,
  cleanTagEntry, cleanTopicDraft, cleanTopicPatch,
} from '../shared/schema.js';
import { openDb, reqDone, txDone, walkCursor } from './db.js';

const NOTE_GONE_ERROR = 'That note no longer exists.';
const TOPIC_GONE_ERROR = 'That topic no longer exists.';
const TAG_GONE_ERROR = 'That tag no longer exists.';

const isLive = (row) => row.deletedAt == null;

// ---------- The change signal ----------
// R7. Tells every other surface that something changed, via chrome.storage.onChanged, so the worker
// never has to enumerate tabs (03-messaging.md). kind is one of 'create', 'update', 'trash',
// 'restore', 'purge', 'topics' or 'tags', and ids are the notes whose records changed.
//
// The bumps run one at a time. The counter is a read followed by a write, so two writes finishing
// together would both read 42 and both store 43, and the second would change only notesRevIds. A
// listener watching changes.notesRev would then never hear about it, which is a stale list with no
// error anywhere. This chain is rebuilt with the module on every worker start, the same as the
// connection in db.js, and the counter itself lives in storage, so a restart loses nothing.
//
// It never rejects. By the time this runs the data has committed, and answering "failed" for a note
// that was in fact saved would be the worse lie. The next bump puts the surfaces right.
let revTail = Promise.resolve();

export function bumpRev(kind, ids) {
  revTail = revTail.then(async () => {
    const { notesRev = 0 } = await chrome.storage.local.get('notesRev');
    await chrome.storage.local.set({ notesRev: notesRev + 1, notesRevIds: ids, notesRevKind: kind });
  }).catch((err) => console.error('[BibleBoost] could not publish a change:', kind, err));
  return revTail;
}

// ---------- The one way to write ----------
// R7 and R8, kept true by construction. This is the only place in the file that opens a readwrite
// transaction, and test/repo.test.js fails if a second one appears, so a new operation cannot write
// without getting one transaction and exactly one bump after it commits.
//
// work(tx, now) does its requests and resolves to { ids, value }: ids is what changed, for the
// signal, and value is what the caller gets back. One clock reading per operation, so everything a
// bulk action stamps carries the same time.
//
// Inside work, await only IndexedDB (02-storage-model.md). A throw from it must call abort, because
// otherwise the transaction simply commits whatever had been done so far, the half-applied state R8
// exists to prevent. The abort makes txDone reject with an error that says nothing, and the throw
// that caused it is the one worth reporting, so that rejection is consumed here.
async function mutate(kind, stores, work) {
  const db = await openDb();
  const tx = db.transaction(stores, 'readwrite');
  const committed = txDone(tx);
  let outcome;
  try {
    outcome = await work(tx, Date.now());
  } catch (err) {
    try { tx.abort(); } catch { /* IndexedDB already aborted it, over a failed request */ }
    await committed.catch(() => {});
    throw err;
  }
  await committed;
  await bumpRev(kind, outcome.ids);
  return outcome.value;
}

// ---------- Inside a transaction ----------
// R2: an unknown topic becomes null rather than an error, and a Trash-bound or wrong-typed value is
// as unknown as a missing one. It also means a live note can never point at a deleted topic, which
// is exactly the unfindable state T-032 describes as the worst outcome.
async function liveTopicId(tx, id) {
  if (typeof id !== 'string' || !id) return null;
  const topic = await reqDone(tx.objectStore('topics').get(id));
  return topic && isLive(topic) ? id : null;
}

// An existing row keeps its label, so the first casing ever typed is the one that sticks (R2).
async function ensureTags(tx, entries, now) {
  const tags = tx.objectStore('tags');
  for (const { name, label } of entries) {
    if (!(await reqDone(tags.get(name)))) await reqDone(tags.add({ ...TAG_DEFAULTS, name, label, createdAt: now }));
  }
}

// Puts back notes changed as a side effect of a tag or topic operation, for the bulk operations.
//
// updatedAt is left alone on purpose. It is what the default list sorts by (T-021 R8), and renaming a
// tag on 40 notes is not editing those 40 notes: stamping them would throw all 40 to the top of the
// list and lose the order the user was working in. trashNotes and restoreNotes leave it alone for a
// related reason: a restored note should come back where it was (T-035 R4).
async function putRewritten(store, notes) {
  for (const note of notes) await reqDone(store.put(note));
}

// ---------- Notes: create and read ----------
export async function createNote(draft) {
  const { fields, tagEntries } = cleanNoteDraft(draft);
  return mutate('create', ['notes', 'topics', 'tags'], async (tx, now) => {
    const topicId = await liveTopicId(tx, fields.topicId);
    await ensureTags(tx, tagEntries, now);
    const note = { ...NOTE_DEFAULTS, ...fields, topicId, id: newId('n', now), createdAt: now, updatedAt: now };
    // add rather than put: an id collision has to be an error, not a silent overwrite of another note.
    await reqDone(tx.objectStore('notes').add(note));
    return { ids: [note.id], value: note };
  });
}

// A trashed note is returned too, because Trash needs to open one. A missing note is null rather
// than an error: looking something up and not finding it is a normal answer.
export async function getNote(id) {
  const key = cleanId(id);
  const db = await openDb();
  return (await reqDone(db.transaction('notes').objectStore('notes').get(key))) ?? null;
}

// R4: a merge over the stored record, so a patch of { body } cannot lose the verses. verseKeys comes
// along in `fields` whenever verses did, derived by the cleaner. Editing a trashed note is allowed,
// so an autosave that loses a race with a delete in another tab does not lose the words.
export async function updateNote(id, patch) {
  const key = cleanId(id);
  const { fields, tagEntries } = cleanNotePatch(patch);
  return mutate('update', ['notes', 'topics', 'tags'], async (tx, now) => {
    const store = tx.objectStore('notes');
    const before = await reqDone(store.get(key));
    if (!before) throw new Error(NOTE_GONE_ERROR);
    const note = { ...before, ...fields, updatedAt: now };
    if (fields.topicId !== undefined) note.topicId = await liveTopicId(tx, fields.topicId);
    await ensureTags(tx, tagEntries, now);
    await reqDone(store.put(note));
    return { ids: [key], value: note };
  });
}

// ---------- Notes: delete ----------
// R5. A note that is already in Trash is skipped, so a second delete does not restart its 30 days.
//
// undoToken is the list of ids this call actually moved. Passing it to notes/restore puts back
// exactly those and leaves alone anything that was in Trash already. It holds no state in the worker,
// so it still works after Chrome has stopped and restarted it.
export async function trashNotes(ids) {
  const wanted = cleanIds(ids);
  return mutate('trash', ['notes'], async (tx, now) => {
    const store = tx.objectStore('notes');
    const changed = [];
    for (const id of wanted) {
      const note = await reqDone(store.get(id));
      if (!note || !isLive(note)) continue;
      await reqDone(store.put({ ...note, deletedAt: now }));
      changed.push(id);
    }
    return { ids: changed, value: { undoToken: changed } };
  });
}

// A note whose topic was deleted while it sat in Trash lands in Uncategorized, and the reply names
// those notes so the surface can say so (T-034 R2). Restoring it with the old id would produce the
// note nothing can find.
export async function restoreNotes(ids) {
  const wanted = cleanIds(ids);
  return mutate('restore', ['notes', 'topics'], async (tx) => {
    const store = tx.objectStore('notes');
    const changed = [];
    const uncategorized = [];
    for (const id of wanted) {
      const note = await reqDone(store.get(id));
      if (!note || isLive(note)) continue;
      const topicId = await liveTopicId(tx, note.topicId);
      if (note.topicId !== null && topicId === null) uncategorized.push(id);
      await reqDone(store.put({ ...note, topicId, deletedAt: null }));
      changed.push(id);
    }
    return { ids: changed, value: { restored: changed, uncategorized } };
  });
}

// The real deletion, reachable only from Trash and auto-purge (R5), and the check here is what
// makes that true rather than a convention. A live note is skipped, not an error, because an "Empty
// Trash" whose list is a moment old must still clear the rest when one note was just restored.
export async function purgeNotes(ids) {
  const wanted = cleanIds(ids);
  return mutate('purge', ['notes'], async (tx) => {
    const store = tx.objectStore('notes');
    const changed = [];
    for (const id of wanted) {
      const note = await reqDone(store.get(id));
      if (!note || isLive(note)) continue;
      await reqDone(store.delete(id));
      changed.push(id);
    }
    return { ids: changed, value: { purged: changed } };
  });
}

// ---------- Notes: list ----------
// A note with several verses in one chapter sits in byVerse once per verse, so the prefix ends in a
// dot: without it EXO.1 would also match every key of EXO.13. ￿ is the top of the UTF-16 range
// IndexedDB compares strings by, so the upper bound is past anything after that prefix.
const prefixRange = (prefix) => ({ lower: prefix, upper: `${prefix}￿` });

// R6 and T-005's note on nulls. Picks the one index a query reads, without touching a database, so
// that the choice can be tested in Node. The ranges are plain data for the same reason: IDBKeyRange
// does not exist there.
//
// `ordered` means the index already yields rows in the requested order, so a cursor can walk it and
// keep only the page. `countable` means the total can be had from two index counts, so that walk
// can stop as soon as the page is full, which is what keeps the most common call of all, the
// unfiltered first page, from reading every note.
//
// The narrowing filters are tried from the fewest expected matches to the most, and the rest are
// applied by noteMatches. T-028 R8 asks for this and T-028 owns anything smarter. A null topicId and
// "not deleted" cannot use an index at all, because a null is not a valid key and those rows are
// missing from byTopic and byDeleted (02-storage-model.md), so both walk byUpdated and skip.
export function planNoteQuery(filter, sort) {
  const narrow =
    filter.verseKey !== undefined ? { index: 'byVerse', range: { only: filter.verseKey } } :
    filter.chapter !== undefined ? { index: 'byVerse', range: prefixRange(`${filter.chapter}.`) } :
    filter.tag !== undefined ? { index: 'byTag', range: { only: filter.tag } } :
    typeof filter.topicId === 'string' ? { index: 'byTopic', range: { only: filter.topicId } } :
    null;
  if (narrow) return { ...narrow, ordered: false, countable: false, direction: 'next' };

  const direction = sort.dir === 'asc' ? 'next' : 'prev';
  const dated = filter.from !== undefined || filter.to !== undefined;
  const countable = !dated && filter.topicId === undefined;
  if (filter.trashed && !dated) return { index: 'byDeleted', range: null, ordered: sort.by === 'deletedAt', countable, direction };
  // ids sort by creation time (schema.js), so the store's own key order IS created order.
  if (sort.by === 'createdAt' && !dated) return { index: null, range: null, ordered: true, countable, direction };
  return { index: 'byUpdated', range: dated ? { lower: filter.from, upper: filter.to } : null, ordered: sort.by === 'updatedAt', countable, direction };
}

function toKeyRange(range) {
  if (!range) return null;
  if ('only' in range) return IDBKeyRange.only(range.only);
  if (range.upper === undefined) return IDBKeyRange.lowerBound(range.lower);
  if (range.lower === undefined) return IDBKeyRange.upperBound(range.upper);
  return IDBKeyRange.bound(range.lower, range.upper);
}

// The whole filter, including whichever part the index already answered: re-checking it costs
// nothing, and it means the planner can only ever choose the wrong speed, never the wrong notes.
export function noteMatches(note, filter) {
  if (filter.trashed === isLive(note)) return false;
  if (filter.topicId !== undefined && note.topicId !== filter.topicId) return false;
  if (filter.tag !== undefined && !note.tags.includes(filter.tag)) return false;
  if (filter.verseKey !== undefined && !note.verseKeys.includes(filter.verseKey)) return false;
  if (filter.chapter !== undefined && !note.verseKeys.some((k) => k.startsWith(`${filter.chapter}.`))) return false;
  if (filter.from !== undefined && note.updatedAt < filter.from) return false;
  if (filter.to !== undefined && note.updatedAt > filter.to) return false;
  return true;
}

// The id tiebreak makes a page boundary stable when two notes share a timestamp, as every note of a
// bulk action does.
export const noteComparator = ({ by, dir }) => {
  const sign = dir === 'asc' ? 1 : -1;
  return (a, b) => sign * ((a[by] - b[by]) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
};

export async function listNotes({ filter, sort, page } = {}) {
  const f = cleanNoteFilter(filter);
  const s = cleanNoteSort(sort, f);
  const { offset, limit } = cleanPage(page);
  const plan = planNoteQuery(f, s);

  const db = await openDb();
  const store = db.transaction('notes').objectStore('notes');
  const source = plan.index ? store.index(plan.index) : store;
  const range = toKeyRange(plan.range);

  // A narrow query: few rows, and the index's order is the wrong one, so sort them here. The Map is
  // what removes the duplicates a multiEntry index yields, one per matching key.
  if (!plan.ordered) {
    const found = new Map();
    for (const note of await reqDone(source.getAll(range))) {
      if (noteMatches(note, f)) found.set(note.id, note);
    }
    const sorted = [...found.values()].sort(noteComparator(s));
    return { notes: sorted.slice(offset, offset + limit), total: sorted.length };
  }

  let total = null;
  if (plan.countable) {
    const trashed = await reqDone(store.index('byDeleted').count());
    total = f.trashed ? trashed : (await reqDone(store.count())) - trashed;
  }

  // The cursor loads one note at a time and only the page is kept, so a walk over every row still
  // does not hold every note in memory.
  const notes = [];
  let matched = 0;
  await walkCursor(source.openCursor(range, plan.direction), (note) => {
    if (!noteMatches(note, f)) return true;
    matched += 1;
    if (matched > offset && notes.length < limit) notes.push(note);
    return total === null || notes.length < limit;
  });
  return { notes, total: total ?? matched };
}

// ---------- Topics ----------
export async function listTopics() {
  const db = await openDb();
  const rows = await reqDone(db.transaction('topics').objectStore('topics').index('byOrder').getAll());
  return rows.filter(isLive);
}

// A new topic goes last, so it does not jump into the middle of an order the user arranged (T-031).
export async function createTopic(draft) {
  const fields = cleanTopicDraft(draft);
  return mutate('topics', ['topics'], async (tx, now) => {
    const topics = tx.objectStore('topics');
    const last = await reqDone(topics.index('byOrder').openCursor(null, 'prev'));
    const parentId = await liveTopicId(tx, fields.parentId);
    const topic = { ...TOPIC_DEFAULTS, ...fields, parentId, id: newId('t', now), order: last ? last.value.order + 1 : 0, createdAt: now, updatedAt: now };
    await reqDone(topics.add(topic));
    return { ids: [], value: topic };
  });
}

export async function updateTopic(id, patch) {
  const key = cleanId(id);
  const fields = cleanTopicPatch(patch);
  return mutate('topics', ['topics'], async (tx, now) => {
    const topics = tx.objectStore('topics');
    const before = await reqDone(topics.get(key));
    if (!before || !isLive(before)) throw new Error(TOPIC_GONE_ERROR);
    const topic = { ...before, ...fields, updatedAt: now };
    // A topic cannot be its own parent. Nothing builds a tree yet (T-031 R7), which is the time to
    // keep a cycle out of the data rather than after one exists.
    if (fields.parentId !== undefined) topic.parentId = fields.parentId === key ? null : await liveTopicId(tx, fields.parentId);
    await reqDone(topics.put(topic));
    return { ids: [], value: topic };
  });
}

// One transaction, because a topic row gone with notes still pointing at it is the exact failure
// T-032 exists to prevent. The row is soft deleted so that T-032's undo has something to restore.
//
// Only live notes are changed. A note already in Trash keeps its topicId, so undoing this delete
// puts it back under the topic. If the delete stands, restoreNotes sends it to Uncategorized.
export async function deleteTopic(id, strategy) {
  const key = cleanId(id);
  if (!TOPIC_DELETE_STRATEGIES.includes(strategy)) throw new Error(`Deleting a topic needs a strategy: ${TOPIC_DELETE_STRATEGIES.join(' or ')}.`);
  return mutate('topics', ['notes', 'topics'], async (tx, now) => {
    const topics = tx.objectStore('topics');
    const topic = await reqDone(topics.get(key));
    if (!topic || !isLive(topic)) throw new Error(TOPIC_GONE_ERROR);

    const notes = tx.objectStore('notes');
    const carried = (await reqDone(notes.index('byTopic').getAll(key))).filter(isLive);
    for (const note of carried) {
      if (strategy === 'reassign') note.topicId = null;
      else note.deletedAt = now;
    }
    await putRewritten(notes, carried);

    for (const child of await reqDone(topics.index('byParent').getAll(key))) {
      await reqDone(topics.put({ ...child, parentId: null, updatedAt: now }));
    }
    await reqDone(topics.put({ ...topic, deletedAt: now, updatedAt: now }));
    const ids = carried.map((n) => n.id);
    return { ids, value: { affected: ids.length } };
  });
}

// Counts exclude Trash (T-031 R9). The expensive way is to read every note, so this uses index
// counts and reads only Trash, which auto-purge keeps small. byTopic has no row for a null topicId,
// so everything in the store that byTopic does not count, less Trash's share, is Uncategorized.
export async function topicCounts() {
  const db = await openDb();
  const tx = db.transaction(['notes', 'topics']);
  const notes = tx.objectStore('notes');
  const byTopic = notes.index('byTopic');

  const trashed = await reqDone(notes.index('byDeleted').getAll());
  const trashedIn = new Map();
  for (const note of trashed) trashedIn.set(note.topicId, (trashedIn.get(note.topicId) ?? 0) + 1);

  const topics = {};
  for (const topic of await reqDone(tx.objectStore('topics').getAll())) {
    if (isLive(topic)) topics[topic.id] = (await reqDone(byTopic.count(topic.id))) - (trashedIn.get(topic.id) ?? 0);
  }
  const uncategorized = (await reqDone(notes.count())) - (await reqDone(byTopic.count())) - (trashedIn.get(null) ?? 0);
  return { topics, uncategorized, trash: trashed.length };
}

// ---------- Tags ----------
export async function listTags() {
  const db = await openDb();
  const rows = await reqDone(db.transaction('tags').objectStore('tags').getAll());
  return rows.sort((a, b) => compareText(a.name, b.name));
}

// Trashed notes are rewritten as well, because byTag holds them and a note restored later must not
// carry a tag that no longer has a row.
async function notesCarrying(store, names) {
  const carriers = new Map();
  for (const name of names) {
    for (const note of await reqDone(store.index('byTag').getAll(name))) carriers.set(note.id, note);
  }
  return [...carriers.values()];
}

// A rename that only changes the casing keeps the same key, so no note has to change. Renaming onto
// a different tag that already exists is refused rather than quietly merged: T-033 R3 wants the user
// offered the merge, and a merge cannot be told apart from a rename once it is done.
export async function renameTag(from, to) {
  const source = cleanId(normalizeTag(from));
  const target = cleanTagEntry(to);
  return mutate('tags', ['notes', 'tags'], async (tx) => {
    const tags = tx.objectStore('tags');
    const row = await reqDone(tags.get(source));
    if (!row) throw new Error(TAG_GONE_ERROR);
    if (target.name === source) {
      await reqDone(tags.put({ ...row, label: target.label }));
      return { ids: [], value: { affected: 0 } };
    }
    if (await reqDone(tags.get(target.name))) throw new Error(`A tag named "${target.label}" already exists. Merge the two instead.`);

    const notes = tx.objectStore('notes');
    const carriers = await notesCarrying(notes, [source]);
    for (const note of carriers) note.tags = retag(note.tags, [source], target.name);
    await putRewritten(notes, carriers);
    // The key is the name, so a rename is a new row and the removal of the old one.
    await reqDone(tags.delete(source));
    await reqDone(tags.add({ ...row, name: target.name, label: target.label }));
    const ids = carriers.map((n) => n.id);
    return { ids, value: { affected: ids.length } };
  });
}

// The target is taken out of the sources first, because merging a tag "into itself" would otherwise
// delete it. An existing target keeps its label (T-033 R8), which ensureTags already does.
export async function mergeTags(from, into) {
  if (!Array.isArray(from)) throw new Error('Choose the tags to merge.');
  const target = cleanTagEntry(into);
  const sources = [...new Set(from.map(normalizeTag))].filter((name) => name && name !== target.name);
  if (!sources.length) throw new Error('Choose at least one other tag to merge.');
  return mutate('tags', ['notes', 'tags'], async (tx, now) => {
    const notes = tx.objectStore('notes');
    const carriers = await notesCarrying(notes, sources);
    for (const note of carriers) note.tags = retag(note.tags, sources, target.name);
    await putRewritten(notes, carriers);
    await ensureTags(tx, [target], now);
    const tags = tx.objectStore('tags');
    for (const name of sources) await reqDone(tags.delete(name));
    const ids = carriers.map((n) => n.id);
    return { ids, value: { affected: ids.length } };
  });
}

export async function deleteTag(name) {
  const source = cleanId(normalizeTag(name));
  return mutate('tags', ['notes', 'tags'], async (tx) => {
    const tags = tx.objectStore('tags');
    if (!(await reqDone(tags.get(source)))) throw new Error(TAG_GONE_ERROR);
    const notes = tx.objectStore('notes');
    const carriers = await notesCarrying(notes, [source]);
    for (const note of carriers) note.tags = retag(note.tags, [source]);
    await putRewritten(notes, carriers);
    await reqDone(tags.delete(source));
    const ids = carriers.map((n) => n.id);
    return { ids, value: { affected: ids.length } };
  });
}
