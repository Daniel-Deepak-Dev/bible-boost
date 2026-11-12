# T-027 — Multi-select and bulk actions

| Field | Value |
|---|---|
| Epic | EPIC-03 Full-page app |
| Status | Not started |
| Depends on | T-025 |
| Blocks | — |
| Size | M |
| Risk | Medium — bulk operations are where "necessary warnings" matter most |

## Why

Reorganising is the thing the full page is for. After a few months of saving
verses opportunistically, a user wants to move thirty notes into a new topic, or
retag a study, or export one topic to share. One at a time, that is unusable.

Bulk operations are also the highest-stakes place in the application: a mistaken
bulk delete loses far more than a mistaken single delete.

## Scope

**In:** selection, the bulk action bar, and the confirmations that go with it.

**Out:** the export formats themselves (EPIC-06) — this provides the selection
that `io/export` is called with.

## Requirements

**R1.** Selection by checkbox, with Shift+click for a range and Ctrl/Cmd+click
for individual toggling. Ctrl/Cmd+A selects everything **currently filtered**,
not everything in the database — and the action bar must say which.

**R2.** A bulk action bar appears only when something is selected, showing the
count: move to topic, add tag, remove tag, delete, export selection.

**R3.** Every bulk operation is **one worker call with an id array**, not a loop
of single calls. Looping produces N `notesRev` bumps, N re-renders, and a
half-applied state if one fails.

**R4.** Each operation runs in **one IndexedDB transaction**. Partial application
of a bulk action is worse than failure, because the user cannot tell what
happened.

**R5. Warnings, scaled to consequence:**

| Action | Treatment |
|---|---|
| Move to topic | no dialog; undo toast |
| Add / remove tag | no dialog; undo toast |
| Delete (to Trash) | confirm with the count; then undo toast |
| Delete forever | confirm with the count **and** type-to-confirm |

**R6.** Undo for bulk operations restores the **previous state**, not just the
inverse action. Moving notes that were in three different topics into one, then
undoing, must put each back where it was — not dump them all in Uncategorized.
This means capturing the prior values before the write.

**R7.** Show progress for operations over ~50 notes, and keep the UI responsive.

**R8.** Selection survives sorting and scrolling, and clears on a filter change —
with the count shown before it clears, so a silent loss of selection does not
surprise.

**R9.** Keyboard: Space toggles the focused row, Shift+arrows extend, Escape
clears.

## Files

- `src/ui/app/list.js` — selection model
- `src/ui/app/bulk.js` — new, the action bar
- `src/ui/app/dialog.js` — confirm and type-to-confirm
- `src/background/repo.js` — batch operations, one transaction each

## Reference

- `work/understandings/extension/03-messaging.md` — batch message shapes
- `work/understandings/extension/02-storage-model.md` — soft delete, transactions
- `work/understandings/conventions/01-code-style.md`

## Acceptance

- [ ] Shift+click selects a range; Ctrl/Cmd+click toggles one
- [ ] Ctrl/Cmd+A selects the filtered set, and the bar says so
- [ ] Moving 20 notes to a topic is one worker call and one `notesRev` bump
- [ ] Undoing that move returns each note to its **original** topic, including
      notes that came from different topics
- [ ] Bulk delete confirms with the count
- [ ] Delete forever requires typing a confirmation
- [ ] A bulk operation that fails midway leaves **no** notes changed
- [ ] 200 notes can be retagged without the UI locking up
- [ ] Changing the filter clears the selection, having shown the count first
- [ ] Space, Shift+arrows and Escape work

## Notes

R6 is the requirement most likely to be skipped and most likely to be noticed.
"Undo" that restores a wrong-but-plausible state is worse than no undo, because
the user trusts it.

**From T-022 (2026-11-12).** The confirm with the count already exists:
`moveToTrash(ids, { toasts, list })` in `src/ui/app/trash.js` asks whenever it is
given two or more ids, then shows one undo toast for them all. The panel reaches it
from the Console as `bbPanel.trash(ids)`. Hand it the selection rather than writing a
second one.
