# T-034 — Trash: restore, delete forever, auto-purge

| Field | Value |
|---|---|
| Epic | EPIC-04 Organization |
| Status | Not started |
| Depends on | T-005 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

Soft delete is only half a safety net. Without somewhere to see and recover
deleted notes, `deletedAt` is just a hidden flag, and a note deleted five minutes
after the undo toast expired is gone as far as the user is concerned.

Trash is also what makes every other destructive action in the application safe
to offer, because it is the floor they all land on.

## Scope

**In:** the Trash view, restore, permanent deletion, auto-purge.

**Out:** the undo toast (T-035), which covers the seconds immediately after a
delete.

## Requirements

**R1.** A Trash entry in the sidebar showing the count, listing notes with
`deletedAt != null`, most recently deleted first, with the deletion date and the
days remaining.

**R2.** Restore returns a note to its **original topic**. If that topic has since
been deleted, restore to Uncategorized and say so — do not fail, and do not
recreate the topic.

**R3. Delete forever is the only true deletion.** Confirm with a dialog, and for
more than one note require **type-to-confirm**. There is no undo; the dialog must
say so explicitly.

**R4.** Empty Trash: type-to-confirm with the count.

**R5. Auto-purge after 30 days.** Run on `chrome.runtime.onStartup` and
`onInstalled`, and opportunistically on worker wake — **not** on a timer. The
worker is not persistent and a timer will not survive.

**R6.** Purging is a **bounded batch**. Purging thousands of notes in one
transaction on startup would block. Cap it per run and continue on the next wake.

**R7.** The retention period is a setting in `storage.local`, default 30 days,
with "never" available. A user who deletes rarely and regrets occasionally should
be able to choose.

**R8.** Warn before the first auto-purge of a session if notes are about to
expire within a few days — a silent purge is indistinguishable from data loss.

**R9.** Trashed notes are excluded from the default list, from search, from
counts and from export — **unless** explicitly scoped to Trash. Every one of
those is a separate place to get it wrong; check each.

**R10.** Purging a note removes its draft buffer key (T-030's R8) too.

## Files

- `src/ui/app/trash.js` — new
- `src/background/repo.js` — `notes/purge`, the purge sweep
- `background.js` — `onStartup` / `onInstalled` hooks
- `src/ui/app/dialog.js` — type-to-confirm

## Reference

- `work/understandings/extension/02-storage-model.md` — soft delete, `deletedAt`,
  the `byDeleted` index
- `work/understandings/extension/05-mv3-constraints.md` — the worker is not
  persistent; no timers
- `work/requirements/EPIC-04-organization/EPIC.md` — the warning policy

## Acceptance

- [ ] Deleted notes appear in Trash with their date and days remaining
- [ ] Restore returns a note with its topic, tags, verses and body intact
- [ ] Restoring a note whose topic was deleted lands it in Uncategorized with a
      message
- [ ] Delete forever confirms and says it cannot be undone
- [ ] Multiple permanent deletion requires type-to-confirm
- [ ] A note older than 30 days is purged on startup
- [ ] Changing retention to "never" stops purging
- [ ] Purging 500 notes does not block the worker — it batches across wakes
- [ ] Trashed notes do not appear in: the default list, search results, topic
      counts, tag counts, or an export
- [ ] Purging clears the note's draft key

## Notes

R9 lists five independent places. Tick them one at a time — a trashed note
reappearing in search is a small bug that reads as a serious one.

**From T-022 (2026-11-12).** T-022 R7 lists Delete forever with a type-to-confirm.
`src/ui/app/dialog.js` has only the plain confirm, because nothing could call
type-to-confirm before this view exists. Add it there as an option of
`confirmDialog`, so the panel and the full page share it.
