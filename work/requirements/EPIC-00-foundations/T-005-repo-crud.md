# T-005 — repo.js: CRUD, soft delete, bumpRev

| Field | Value |
|---|---|
| Epic | EPIC-00 Foundations |
| Status | Not started |
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

## Reference

- `work/understandings/extension/02-storage-model.md` — record shapes, decisions
- `work/understandings/extension/03-messaging.md` — handler names and payloads
- `work/understandings/bible-com/07-i18n-and-scripts.md` — tag normalization must
  be NFC + `toLocaleLowerCase`, never `toLowerCase`

## Acceptance

- [ ] From an extension page console, create a note with two verses and three
      tags; it comes back with an id, timestamps, sorted deduped tags, and
      `verseKeys` matching `verses`
- [ ] Tags typed as `Faith`, `faith` and `FAITH` collapse to one tag whose
      `label` is the first casing seen
- [ ] A Tamil tag survives create → list → search unchanged
- [ ] `listNotes({topicId})` and `listNotes({tag})` return correct sets
- [ ] `listNotes({filter:{chapter:'EXO.13'}})` returns notes on any verse of that
      chapter
- [ ] Trashed notes vanish from the default list and appear with
      `filter.trashed`
- [ ] Restore brings a note back with its topic and tags intact
- [ ] `notesRev` in `storage.local` increments on **every** create, update,
      trash, restore and purge
- [ ] A draft with no verses and no body is rejected with a clear error
- [ ] A draft with an unknown `topicId` is stored with `topicId: null`

## Notes

Resist adding convenience wrappers elsewhere later. If a surface needs a new
query, it belongs here.

**A `null` field is not in its index** (`02-storage-model.md`, measured during
T-003). R6's "use the indexes" cannot apply to `topicId: null` (Uncategorized) or
to "not deleted", because `byTopic` and `byDeleted` do not hold those rows. Walk
`byUpdated` with a cursor and skip instead.
