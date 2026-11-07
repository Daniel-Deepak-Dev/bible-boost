# T-022 — Inline create, edit and delete-with-undo

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Not started |
| Depends on | T-021 |
| Blocks | — |
| Size | M |
| Risk | Low |

## Why

The requirement is proper CRUD **in every place**, with necessary warnings. The
panel is where notes are read most, so it is where editing must be possible
without a context switch to the full page.

On warnings: a confirm dialog on every delete punishes the common case and barely
protects the rare one. **Soft delete plus an undo toast** is faster to use and
safer, because it is actually reversible. Modals are reserved for the genuinely
irreversible.

## Scope

**In:** editing, creating and trashing from the panel, with undo.

**Out:** topic and tag management (EPIC-04), Trash view (T-034), bulk actions
(EPIC-03).

## Requirements

**R1.** Clicking a row expands it in place into an editor: title, body textarea,
topic picker, tag input. **Expand in place** — do not navigate away. The panel is
narrow and a push-navigation stack would cost more room than it saves.

**R2.** **Autosave on a debounce** (~600ms) and on blur. An explicit Save button
in a panel this size is one control too many, and losing a note because the user
closed the panel is unacceptable. Show a quiet saved indicator.

**R3.** Send `notes/update` with a **patch**, never the whole record. Two
surfaces can have the same note open; a wholesale replace would clobber the
other's change.

**R4.** Create a standalone note (no verse attached) with a "+" in the header.
A note need not be about a verse.

**R5.** Delete is a **soft delete** via `notes/trash`, followed by an undo toast
lasting ~5 seconds. No confirm dialog. The toast's Undo calls `notes/restore`.

**R6.** The toast is dismissible, stacks sensibly if several deletes happen
quickly, and does not cover the list's last row.

**R7. Warn on genuinely irreversible or surprising actions only:**

| Action | Treatment |
|---|---|
| Delete one note | undo toast, no dialog |
| Delete several notes | confirm, with the count |
| Delete forever (Trash) | confirm, type-to-confirm |
| Discard an unsaved new note | confirm if it has content |

**R8.** Conflict handling: if `notesRev` reports this note changed elsewhere
while it is open and dirty, show a non-blocking notice offering to reload. Do not
silently overwrite, and do not block the user's typing.

**R9.** The editor is a **plain textarea of Markdown source** — no
contenteditable, no formatting toolbar. The toolbar lives in the full page
(EPIC-03) where there is room.

**R10.** Escape collapses the editor (after autosave has flushed). Ctrl/Cmd+Enter
collapses and saves immediately.

## Files

- `src/ui/app/editor.js`, `src/ui/app/toast.js`, `src/ui/app/dialog.js` — new,
  shared with the full page
- `src/ui/panel.js`, `src/ui/ui.css`

## Reference

- `work/understandings/extension/03-messaging.md` — `notes/update` patches,
  `notes/trash`, `notes/restore`, `notesRev`
- `work/understandings/extension/02-storage-model.md` — soft delete is the only
  delete in normal use
- `work/understandings/conventions/02-css-and-theming.md`

## Acceptance

- [ ] Clicking a row expands it in place; editing autosaves without a Save button
- [ ] Closing the panel mid-edit does not lose the change
- [ ] Deleting shows an undo toast; Undo restores the note with topic and tags
      intact
- [ ] Letting the toast expire leaves the note in Trash, not purged
- [ ] Editing the same note in the full page and the panel: the second surface
      shows a conflict notice rather than clobbering
- [ ] A standalone note with no verse can be created and saved
- [ ] Deleting three selected notes asks for confirmation with the count
- [ ] Escape and Ctrl/Cmd+Enter behave as specified
- [ ] `notesRev` increments on every operation
- [ ] At 280px the editor is still usable

## Notes

R3 is easy to get wrong and hard to notice: sending the whole record works
perfectly until two surfaces are open, which is exactly the configuration this
project is building toward.
