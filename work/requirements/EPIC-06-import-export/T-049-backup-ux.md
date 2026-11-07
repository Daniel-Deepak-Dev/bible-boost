# T-049 — Backup UX and export nag

| Field | Value |
|---|---|
| Epic | EPIC-06 Import and export |
| Status | Not started |
| Depends on | T-043 |
| Blocks | — |
| Size | S |
| Risk | Low to build, **high consequence if omitted** |

## Why

This is the project's answer to its biggest weakness. Notes live only in this
browser profile. Clearing browsing data, removing the extension, or a profile
reset destroys all of them, with no recovery and no warning.

`unlimitedStorage` and `navigator.storage.persist()` reduce the chance of
*eviction*. Neither protects against the user deliberately clearing data, which
is the realistic loss scenario. Until sync exists, **export is the backup**, and
a backup feature nobody uses is not a backup.

## Scope

**In:** making backup easy, tracking when it last happened, reminding
proportionately, and being honest about durability.

**Out:** cloud sync — a post-v1 item, deliberately.

## Requirements

**R1.** A prominent one-click **Back up now** in the notes page, exporting
everything as JSON with no dialog and no options. Zero friction is the point.

**R2.** Record `lastExportAt` in `storage.local` on every successful export,
including scoped ones — but track full-backup time separately. A single-topic
export is not a backup and must not reset the clock.

**R3.** After 30 days with no full backup, show a **dismissible, non-blocking**
reminder in the notes page and the panel. Never a modal, never on bible.com
itself.

**R4.** Dismissing snoozes for 7 days. A nag that returns every session gets
ignored, and then the real warning is ignored too.

**R5.** Show the status plainly — "Last backed up 3 days ago" or "Never backed
up" — in the notes page footer or settings. Visible, not hidden behind a menu.

**R6. Be honest about durability.** A short settings note explaining that notes
are stored locally in this browser profile, that clearing browsing data will
delete them, and that export is the way to keep a copy.

**Never tell the user their notes are safe.** They are not, and the mitigations
do not make them so.

**R7.** Show whether `navigator.storage.persist()` was granted (recorded in
T-003's R6). If it was refused, say so — it changes the real risk.

**R8.** A first-run hint pointing at backup once the user has more than ~20
notes. Not on install, when it is meaningless; at the point where there is
something to lose.

**R9.** Offer backup before any destructive bulk operation — empty Trash, import
with Overwrite, clear all data.

**R10. Clear all data** lives here: type-to-confirm, and it **offers an export
first** in the same dialog.

**R11.** Do **not** auto-download on a schedule. Silent writes to the Downloads
folder are a surprise, and the `downloads` permission is one we have deliberately
avoided.

## Files

- `src/ui/app/io-ui.js` — backup button, status, reminder
- `src/ui/notes.js`, `src/ui/panel.js`
- `background.js` — `lastExportAt`, persistence state
- `README.md` — document the durability caveat

## Reference

- `work/understandings/extension/02-storage-model.md` — **the durability
  weakness**, stated in full
- `work/understandings/extension/05-mv3-constraints.md` — `unlimitedStorage`,
  eviction, why no `downloads` permission
- `work/requirements/EPIC-06-import-export/T-043-json-export.md`

## Acceptance

- [ ] Back up now exports everything as JSON in one click, no dialog
- [ ] `lastExportAt` updates, and the status shows it
- [ ] A scoped export does **not** reset the full-backup clock
- [ ] With `lastExportAt` set 31 days back, the reminder appears in both
      surfaces
- [ ] It never appears on bible.com itself
- [ ] Dismissing snoozes it for 7 days
- [ ] "Never backed up" shows when there is no record
- [ ] Persistence state is shown honestly, including when refused
- [ ] Empty Trash, Overwrite import and Clear all each offer a backup first
- [ ] Clear all requires type-to-confirm
- [ ] The durability explanation is present and does not claim the notes are safe
- [ ] Nothing is ever downloaded without an explicit click

## Notes

R6 is a judgement about honesty, and it is the right one. A user who knows the
risk will back up; a user reassured by vague wording will not, and will lose
everything exactly once.
