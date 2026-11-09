# T-005 — repo.js: CRUD, soft delete, bumpRev

| Field | Value |
|---|---|
| Epic | EPIC-00 Foundations |
| Status | Done |
| Depends on | T-003 |
| Blocks | every epic after this one |
| Size | M |
| Risk | Medium |

## Why

This is the single authority the architecture is built around. Every surface —
the save popover, the panel, the full page, import — writes notes through these
functions and nowhere else. One validator, one id generator, one place that keeps
`verseKeys` in step with `verses`, one place that bumps the change counter.

## Scope

**In:** note / topic / tag CRUD, soft delete, validation, and the change signal.

**Out:** search (T-036), import/export (EPIC-06), the topic-delete *dialog*
(T-032 — this task provides the `strategy` parameter it calls with).

## Requirements

**R1.** `src/background/repo.js` exports: `createNote`, `getNote`, `updateNote`,
`listNotes`, `trashNotes`, `restoreNotes`, `purgeNotes`, plus the topic and tag
operations in the catalogue in `extension/03-messaging.md`.

**R2.** `createNote(draft)` **validates and normalizes** — the content script
sends raw page data and must not be trusted to have done any of this:

- assign `id` via `newId('n')`, `createdAt`, `updatedAt`
- normalize every tag (NFC, `toLocaleLowerCase()`), dedupe, sort
- create any tag row that does not exist yet, preserving the user's casing as
  `label`
- derive `verseKeys` from `verses`
- reject a draft with no `verses` **and** no `body` — an empty note is a bug,
  not a feature
- coerce an unknown `topicId` to `null` rather than throwing

**R3.** `verseKeys` is derived in **exactly one** function, called by both create
and update. It duplicates data from `verses` because IndexedDB's `multiEntry`
index needs flat scalars; drift between the two silently breaks verse lookup.

**R4.** `updateNote(id, patch)` merges, never replaces wholesale, always sets
`updatedAt`, and re-derives `verseKeys` when `verses` changed.

**R5.** **Soft delete is the only delete in normal use.** `trashNotes(ids)` sets
`deletedAt`. `restoreNotes(ids)` clears it. `purgeNotes(ids)` is the real
deletion and is reachable only from Trash and from auto-purge.

**R6.** `listNotes({filter, sort, page})` excludes `deletedAt != null` unless
`filter.trashed` is true. Support filtering by `topicId`, `tag`, `verseKey`,
chapter prefix (`EXO.13`), and a date range. Use the indexes; do not load every
note and filter in memory.

**R7.** `bumpRev(kind, ids)` writes `{notesRev, notesRevIds, notesRevKind}` to
`chrome.storage.local`. **Every mutating function calls it, exactly once, after
the transaction commits.** A write that forgets to bump leaves other surfaces
stale, which presents as a CRUD bug and is very hard to trace.

**R8.** Mutations touching several records use **one** IndexedDB transaction, so
a failure does not half-apply.

**R9.** Wire the handlers from `extension/03-messaging.md` into the T-002 router.

## Files

- `src/background/repo.js` — new
- `src/shared/schema.js` — validators, normalizers
- `background.js` — register handlers
- `src/background/db.js` — `walkCursor`, because T-003 R1 keeps every `onsuccess`
  in that file
- `test/repo.test.js` — new; `test/schema.test.js` — extended

## Reference

- `work/understandings/extension/02-storage-model.md` — record shapes, decisions
- `work/understandings/extension/03-messaging.md` — handler names and payloads
- `work/understandings/bible-com/07-i18n-and-scripts.md` — tag normalization must
  be NFC + `toLocaleLowerCase`, never `toLowerCase`

## Acceptance

- [x] From an extension page console, create a note with two verses and three
      tags; it comes back with an id, timestamps, sorted deduped tags, and
      `verseKeys` matching `verses`
- [x] Tags typed as `Faith`, `faith` and `FAITH` collapse to one tag whose
      `label` is the first casing seen
- [x] A Tamil tag survives create → list unchanged, and is found by a decomposed
      spelling
- [x] `listNotes({filter:{topicId}})` and `listNotes({filter:{tag}})` return
      correct sets
- [x] `listNotes({filter:{chapter:'EXO.13'}})` returns notes on any verse of that
      chapter
- [x] Trashed notes vanish from the default list and appear with
      `filter.trashed`
- [x] Restore brings a note back with its topic and tags intact
- [x] `notesRev` in `storage.local` increments on **every** create, update,
      trash, restore and purge
- [x] A draft with no verses and no body is rejected with a clear error
- [x] A draft with an unknown `topicId` is stored with `topicId: null`

## Notes

Resist adding convenience wrappers elsewhere later. If a surface needs a new
query, it belongs here.

**A `null` field is not in its index** (`02-storage-model.md`, measured during
T-003). R6's "use the indexes" cannot apply to `topicId: null` (Uncategorized) or
to "not deleted", because `byTopic` and `byDeleted` do not hold those rows. Walk
`byUpdated` with a cursor and skip instead.

**Two acceptance items were corrected during the work.** `listNotes({topicId})`
contradicted R6's signature, so it now reads `listNotes({filter:{topicId}})`. The
Tamil item said "create → list → search", but search is out of scope here; its
Tamil cases are T-036 to T-038's.

**How the acceptance items are covered.** `node --test` holds the pure parts. On
2026-11-09 the real `background.js`, router, `repo.js` and `db.js` also ran against
real IndexedDB in a Chrome 152 page, with messages and replies going through JSON
and only the `chrome.*` calls stubbed: 139 checks, all passing. The same day the
script below ran in the loaded extension and all ten items passed, which also covers
what the page run could not reach: the worker's module graph, real `sendMessage` and
the real `chrome.storage.local`. The one red line in its output is the worker logging
the empty draft that item 9 sends on purpose.

**To repeat it:** reload the extension at `chrome://extensions`, open the popup,
right-click inside it, choose Inspect, and paste this into that window's Console.
It covers all ten items and removes what it creates, except one soft-deleted topic
row called "BB acceptance", which appears nowhere. A worker console will not do:
`runtime.sendMessage` never delivers to its own context.

```js
await (async () => {
  const send = (m) => chrome.runtime.sendMessage(m);
  const rev = async () => (await chrome.storage.local.get('notesRev')).notesRev ?? 0;
  const v = (usfm) => ({ usfm, primary: { versionId: '339', abbr: 'TAOVBSI', lang: 'tam', text: 'x' }, parallel: null });
  const note = async (draft) => (await send({ type: 'notes/create', draft: { source: 'page', ...draft } })).note;
  const get = async (id) => (await send({ type: 'notes/get', id })).note;
  const ids = async (filter, page) => (await send({ type: 'notes/list', filter, page })).notes.map((n) => n.id);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let failed = 0;
  const check = (name, pass, got) => { if (!pass) failed += 1; console[pass ? 'log' : 'error'](pass ? 'PASS' : 'FAIL', name, pass ? '' : got); };
  const bumped = async (name, action) => { const was = await rev(); const out = await action(); const now = await rev(); check(`8 notesRev +1 on ${name}`, now === was + 1, { was, now }); return out; };

  const a = await bumped('create', () => note({ body: 'acceptance', verses: [v('EXO.13.2'), v('EXO.13.3')], tags: ['bb-zeta', 'bb-alpha', 'BB-Alpha', 'bb-mid'] }));
  check('1 id and timestamps', /^n_/.test(a.id) && typeof a.createdAt === 'number' && a.createdAt === a.updatedAt, a);
  check('1 tags sorted and deduped', same(a.tags, ['bb-alpha', 'bb-mid', 'bb-zeta']), a.tags);
  check('1 verseKeys match verses', same(a.verseKeys, ['EXO.13.2', 'EXO.13.3']), a.verseKeys);

  const b = await note({ body: 'x', tags: ['BbFaith', 'bbfaith', 'BBFAITH'] });
  const row = (await send({ type: 'tags/list' })).tags.find((t) => t.name === 'bbfaith');
  check('2 one tag, labelled with the first casing', same(b.tags, ['bbfaith']) && row?.label === 'BbFaith', { tags: b.tags, row });

  const composed = 'bbகொடு';
  const decomposed = 'bbகொடு';
  const c = await note({ body: 'x', tags: [decomposed] });
  check('3 Tamil tag stored composed', same(c.tags, [composed]), c.tags);
  check('3 found by either spelling', same(await ids({ tag: composed }), [c.id]) && same(await ids({ tag: decomposed }), [c.id]));

  const topic = (await send({ type: 'topics/create', name: 'BB acceptance' })).topic;
  const d = await note({ body: 'x', topicId: topic.id, tags: ['bb-zeta'] });
  check('4 by topic', same(await ids({ topicId: topic.id }), [d.id]));
  check('4 by tag', same((await ids({ tag: 'bb-zeta' })).sort(), [a.id, d.id].sort()));

  const e = await note({ verses: [v('EXO.1.1')] });
  const chapter = await ids({ chapter: 'EXO.13' }, { limit: 500 });
  check('5 chapter finds the note once, and not EXO.1', chapter.filter((id) => id === a.id).length === 1 && !chapter.includes(e.id), chapter);

  await bumped('update', () => send({ type: 'notes/update', id: d.id, patch: { title: 'edited' } }));
  const before = await get(d.id);
  const { undoToken } = await bumped('trash', () => send({ type: 'notes/trash', ids: [d.id] }));
  check('6 gone from the default list', !(await ids(undefined, { limit: 500 })).includes(d.id));
  check('6 in Trash', (await ids({ trashed: true }, { limit: 500 })).includes(d.id));
  await bumped('restore', () => send({ type: 'notes/restore', ids: undoToken }));
  check('7 restored exactly as it was', same(await get(d.id), before), await get(d.id));

  const empty = await send({ type: 'notes/create', draft: { source: 'page' } });
  check('9 empty draft refused with a message', empty.ok === false && typeof empty.error === 'string' && empty.error.length > 0, empty);
  const f = await note({ body: 'x', topicId: 't_nope' });
  check('10 unknown topic stored as null', f.topicId === null, f);

  const all = [a, b, c, d, e, f].map((n) => n.id);
  await send({ type: 'notes/trash', ids: all });
  await bumped('purge', () => send({ type: 'notes/purge', ids: all }));
  for (const name of ['bb-alpha', 'bb-mid', 'bb-zeta', 'bbfaith', composed]) await send({ type: 'tags/delete', name });
  await send({ type: 'topics/delete', id: topic.id, strategy: 'reassign' });
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
})();
```

Decisions the task left open, with the reasoning in `repo.js` and
`02-storage-model.md`: a malformed verse refuses the whole draft; `updateNote` may
empty a note, so autosave mid-retype does not fail; trash, restore and bulk tag or
topic rewrites leave `updatedAt` alone; a tag rename onto an existing tag is refused
so that T-033 can offer the merge.
