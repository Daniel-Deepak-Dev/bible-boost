# T-003 — IndexedDB, schema and migration ladder

| Field | Value |
|---|---|
| Epic | EPIC-00 Foundations |
| Status | Done |
| Depends on | T-002 |
| Blocks | T-005 |
| Size | M |
| Risk | Medium — schema mistakes become migrations later |

## Why

Notes cannot live in `storage.sync` (~8 KB per item) and would make
`storage.local` rewrite the whole dataset on every keystroke. IndexedDB gives
indexed queries and partial reads, which is what the panel's chapter filter and
the search index both need.

The migration ladder is included now because it **cannot be retrofitted** once a
user has data. It costs almost nothing today.

## Scope

**In:** opening the database, declaring stores and indexes, the version ladder,
and the `unlimitedStorage` / persistence setup.

**Out:** CRUD operations (T-005), search indexing (T-038).

## Requirements

**R1.** `src/background/db.js` opens database `bibleboost` at version 1 and
exports a promise-wrapped handle. Wrap IndexedDB's event API in promises once,
here; do not scatter `onsuccess` handlers through the codebase.

**R2.** Object stores and indexes exactly as specified in
`work/understandings/extension/02-storage-model.md`:

```
notes   keyPath id   indexes: byUpdated, byTopic, byTag(multiEntry),
                              byVerse(multiEntry), byDeleted
topics  keyPath id   indexes: byParent, byOrder
tags    keyPath name
meta    keyPath key
```

**R3.** `src/background/migrate.js` holds a ladder of `vN -> vN+1` steps, run
inside `onupgradeneeded`. Version 1 is "create everything". Each step is a named
function in an ordered array so the next one is an append, not an edit.

**R4.** Write `{ key: 'schemaVersion', value: SCHEMA_VERSION }` into `meta` on
first open, and read it back on every open. If the stored version is **newer**
than the code's, refuse to write and surface a clear error — an older extension
must not corrupt a newer database.

**R5.** Add `"unlimitedStorage"` to the manifest permissions. It lifts the
`storage.local` cap **and** exempts IndexedDB from quota eviction.

**R6.** Call `navigator.storage.persist()` from the **popup**, on each open until
it is granted, and record the result in `storage.local` under `persistence`
(`{ granted, at }`) so T-049 can tell the user whether persistence was granted.

This first said to call it from `chrome.runtime.onInstalled` in the worker. That
cannot work: `persist()` is `[Exposed=Window]` and is `undefined` in a worker
(measured in Chromium 152). So it runs on the first popup open rather than at
install, and until then `unlimitedStorage` (R5) is what exempts the database from
eviction. `background.js` still adds `onInstalled`, to create the database.

**R7.** Handle a blocked upgrade: if another tab holds an old connection, the
`blocked` event fires. Log it and surface a message rather than hanging silently.

**R8.** Seed nothing. "Uncategorized" is `topicId: null`, not a real topic row —
this avoids a special row that import, export and delete all have to know about.

## Files

- `src/background/db.js` — new
- `src/background/migrate.js` — new
- `test/migrate.test.js` — new, on the T-007 R1 convention
- `popup.js` — the `persist()` call (R6)
- `background.js` — call the opener; add `onInstalled`
- `manifest.json` — add `unlimitedStorage`

## Reference

- `work/understandings/extension/02-storage-model.md` — **normative** schema
- `work/understandings/extension/05-mv3-constraints.md` — quotas, eviction,
  worker lifetime

## Acceptance

- [x] On first load, DevTools → Application → IndexedDB shows `bibleboost` with
      all four stores and every index listed in R2
- [x] `meta` contains `schemaVersion: 1`
- [x] Reloading the extension does not re-run the v1 migration
- [x] `node --test test/migrate.test.js` covers the ladder running from empty to
      v1, and the refuse-on-newer case
- [x] `navigator.storage.persisted()` reports true, or the refusal is recorded
- [x] Opening the extension in two tabs and reloading does not hang

## Notes

Multi-entry indexes need a flat array of scalars, which is why a note carries
both `verses` (rich) and `verseKeys` (flat). Keeping them in sync is T-005's job
and must happen in exactly one function.

**How the acceptance items are covered.** The ladder and refuse-on-newer item is
proven by `test/migrate.test.js`, against a fake that records calls. The real
`db.js` and `migrate.js` were also run against real IndexedDB in a Chromium 152
page on 2026-11-09: the stores and indexes came out as R2 says, and the reopen,
newer, blocked and rollback paths all behaved. The other items were checked by
hand in the loaded extension the same day. When repeating them, reload it **and
then any open bible.com tab** first (B-007).

**"Refuse to write" refuses reads too.** IndexedDB will not open a database at a
lower version than the one on disk, so a build that finds a newer database cannot
read it without guessing at a schema it has never seen.
