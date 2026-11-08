# Storage model

Confidence: **design decision**, approved. Schema is normative.

## Three stores, three jobs

| Where | What | Why |
|---|---|---|
| IndexedDB `bibleboost` | notes, topics, tags, meta | indexed queries, partial reads, scales |
| `chrome.storage.local` | panel open/pinned/width, last filter, `notesRev`, `lastExportAt`, `persistence` | per-device UI state and the change signal |
| `chrome.storage.sync` | **existing settings only** | already working — do not migrate |

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
const id = (p) => p + '_' + Date.now().toString(36) + crypto.randomUUID().slice(0, 8);
```

Generated **only** in the service worker (architecture rule 1).

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
