# Storage model

Confidence: **design decision**, approved. Schema is normative.

## Three stores, three jobs

| Where | What | Why |
|---|---|---|
| IndexedDB `bibleboost` | notes, topics, tags, meta | indexed queries, partial reads, scales |
| `chrome.storage.local` | panel open and pinned (`panelOpen`, `panelPinned`), panel width, last filter, `notesRev`, `lastExportAt`, `persistence` | per-device UI state and the change signal |
| `chrome.storage.sync` | **existing settings only** | already working — do not migrate |

One value sits outside those three: `bb-last-topic`, in the page's own
`sessionStorage`, holding the id of the topic the save popover last used (T-014 R4).
It is per tab and survives a full navigation, which a variable in the content script
would not. `chrome.storage.session` is closed to content scripts until the worker
calls `setAccessLevel` (from Chrome's documentation), and it would give two tabs one
last topic between them. The page can read and write this key, so it holds only an
id, and the popover honours it only if `topics/list` still has that id.

### Do not move the existing settings

`align`, `separators`, `primaryId`, `parallelId`, `lastRef`, `showSwitch` stay in
`storage.sync`. They are small, they benefit from following the user between
machines, and the `store.get(DEFAULTS, cb)` backfill is the existing migration
mechanism. Touching them risks a working feature for no gain.

## IndexedDB schema, version 1

```
notes   keyPath 'id'
  byUpdated  updatedAt
  byTopic    topicId
  byTag      tags       multiEntry
  byVerse    verseKeys  multiEntry
  byDeleted  deletedAt

topics  keyPath 'id'
  byParent   parentId
  byOrder    order

tags    keyPath 'name'      // already normalized

meta    keyPath 'key'       // { key: 'schemaVersion', value: 1 }
```

### How IndexedDB treats this schema

Confidence: **measured**, by running `db.js` and `migrate.js` against real
IndexedDB in a Chromium 152 page on 2026-11-09.

- **A `null` is not a valid key, so a row whose indexed field is null is not in
  that index at all.** Of two notes, one with `topicId: null, deletedAt: null`,
  `byTopic` and `byDeleted` each held one row. That makes `byDeleted` exactly the
  Trash list, but `byTopic` cannot find Uncategorized notes, `byParent` cannot
  find root topics, and neither can answer "everything not deleted". Those need
  a walk of another index.
- **A database newer than the code fails at `open()` with `VersionError`**, before
  `meta` can be read. `db.js` reports it with the same message as a newer `meta`
  row.
- **A ladder step that throws rolls everything back.** The store it had half made
  was gone, and the version and the data were unchanged.
- **`blocked` leaves the open pending.** `db.js` answers the caller at once, and
  closes the connection when the upgrade eventually finishes.
- **Inside a transaction, await only IndexedDB.** After a 50 ms timer, the next
  request threw `TransactionInactiveError`, synchronously.

## Records

```js
// note
{
  id: 'n_<sortableId>',
  title: '',                  // optional; falls back to the verse range
  body: '',                   // Markdown source
  topicId: null,              // exactly one; null = Uncategorized
  tags: ['faith', 'exodus'],  // normalized keys, deduped, sorted
  verses: [VerseRef],
  verseKeys: ['EXO.13.2'],    // flattened, for the multiEntry index
  color: null,
  pinned: false,
  createdAt, updatedAt,
  deletedAt: null,            // soft delete
  source: 'menu' | 'panel' | 'page' | 'import',
}

// VerseRef — captures BOTH parallel versions, deliberately
{
  usfm: 'EXO.13.2', book: 'EXO', chapter: 13, verse: 2,
  displayRef: '<localized ref as shown on the page>',
  primary:  { versionId: '339', abbr: 'TAOVBSI', lang: 'tam', text: '...' },
  parallel: { versionId: '114', abbr: 'NKJV',    lang: 'eng', text: '...' } | null,
}

// topic
{ id: 't_<id>', name, slug, parentId: null, color, order,
  createdAt, updatedAt, deletedAt: null }

// tag
{ name: 'faith',      // normalized; the key
  label: 'Faith',     // what the user typed
  color, createdAt }
```

## What `repo.js` guarantees

Confidence: **measured**, by running the real worker code against real IndexedDB
in a Chrome 152 page on 2026-11-09 (T-005).

- **Timestamps are `Date.now()` numbers.** A `Date` does not survive
  `sendResponse`, which serializes as JSON, and a number is a valid index key.
- **A live note's `topicId` is null or a live topic.** Unknown ids become null at
  create and update. `restoreNotes` nulls a topic deleted in the meantime and names
  those notes in its reply.
- **`updatedAt` means someone edited this note.** Only `updateNote` sets it. Trash,
  restore and bulk tag or topic rewrites leave it alone, because the default list
  sorts by it: renaming a tag on 40 notes must not throw all 40 to the top, and a
  restored note should come back where it was.
- **Topics are soft deleted.** The row stays with `deletedAt` set, so T-032 has
  something to undo. `topics/list` and new notes ignore it. Notes already in Trash
  keep the dead `topicId`.
- **Purge refuses a live note.** It is skipped, which is what makes "only from Trash"
  true rather than a convention. Tag rewrites do reach trashed notes.
- **A failed write applies nothing and bumps nothing.** Checked with a throw part
  way through a three-note trash, and with a real `ConstraintError`.
- **`verses[].book`, `.chapter` and `.verse` come from `usfm`**, never from the
  draft, and a combined `JHN.1.1+JHN.1.2` is stored under `JHN.1.1`.
- **`verses` are in canonical order, and `verseKeys` with them.** `cleanNoteFields` sorts
  with `compareUsfm` on create and on a patch, so no surface has to (T-016). A draft's
  order means nothing: a text range running from the left column into the right gave
  21, 22, 1, 2 in Exodus 13, because `verseEls` reads one column and then the other.
- **`primary` is required and `parallel` is optional.** `cleanSide` refuses a null
  primary with "has no primary text", which refuses the whole draft. `versePair` can
  return one, for a verse selected in the parallel column that the primary version
  lacks, and `verseRefOf` in `save-popover.js` moves that verse's one side into
  `primary` (T-014). So `primary` means the version a note leads with, usually but
  not always the page's primary version: read its `abbr` rather than assuming. Blank
  text is different: `''` passes, and it is what NIV's Matthew 17:21 gives.

How `notes/list` chooses an index, in `planNoteQuery`: verse, chapter, tag or topic
narrow it and sort in memory. Otherwise a cursor walks `byUpdated` (or `byDeleted`
for Trash, or the store itself for created order) and keeps only the page. The
unfiltered list and Trash get `total` from index counts, so they stop at the page.

Measured with about 2,000 notes, each call including its JSON round trip:

| Query | ms |
|---|---|
| Default first page of 50 | 2 |
| Chapter (73 rows) | 1.5 |
| Tag (150 rows) | 4 |
| Topic (1,001 rows) | 13 |
| Uncategorized, a full walk (1,014 rows) | 40 |
| Trash first page | 2 |
| `topics/counts` | 2 |

## Decisions worth not re-litigating

- **`parentId` is in the topic schema from day one** even though nesting is not
  built in v1. Adding it later would be a migration; adding it now is free.
- **`verseKeys` duplicates data already in `verses`.** That is intentional —
  IndexedDB's `multiEntry` index needs a flat array of scalars. Keep them in sync
  in `repo.js`, in one place.
- **Verse text is snapshotted at save time.** A note that re-fetches its text
  breaks when bible.com re-renders, changes markup, or the user is offline. Since
  the user reads in parallel, the stored pair *is* the content of the note.
- **One topic per note, many tags.** Unambiguous in a compact list, trivial to
  export to CSV, matches the save flow.
- **Soft delete everywhere.** `deletedAt` is the only deletion in normal use;
  hard delete happens from Trash or auto-purge at 30 days.

## Id generation

Sortable by creation time, no dependency:

```js
const newId = (p, now = Date.now()) => p + '_' + now.toString(36) + crypto.randomUUID().slice(0, 8);
```

Generated **only** in the service worker (architecture rule 1).

Pass the record's own `createdAt` as `now`. Two separate clock readings came out up
to 1 ms apart, and that made key order disagree with `createdAt` for notes created
back to back. `repo.js` relies on the two agreeing: sorting by created date is a walk
of the store's own keys.

## Migrations

`meta.schemaVersion` plus a ladder in `src/background/migrate.js`. Each step is
`vN -> vN+1`, runs inside the `onupgradeneeded` transaction where possible, and
is covered by a `node --test` case. The ladder costs nothing now and cannot be
retrofitted once user data exists.

## Durability — the known weakness

Local-only data dies with the profile. Clearing browsing data or removing the
extension destroys every note, with no recovery. Mitigations, none of them a
solution:

- `unlimitedStorage` permission (also exempts IndexedDB from eviction)
- `navigator.storage.persist()`, from the popup because a worker cannot call it,
  with the answer in `storage.local` as `persistence`
- one-click backup, `lastExportAt`, a nag after 30 days

**Never tell the user their notes are safe.** Sync is a post-v1 item; the schema
is shaped so it can be added without a migration.
