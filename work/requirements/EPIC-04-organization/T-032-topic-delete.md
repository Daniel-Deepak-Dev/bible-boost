# T-032 — Topic delete with note reassignment

| Field | Value |
|---|---|
| Epic | EPIC-04 Organization |
| Status | Not started |
| Depends on | T-031 |
| Blocks | — |
| Size | S |
| Risk | Medium — the obvious implementation loses data |

## Why

Deleting a topic that holds notes has three possible meanings and the user means
exactly one of them: *get rid of this label*, or *get rid of this whole study*.
Guessing is how notes vanish.

The naive implementation — delete the topic row and leave the notes pointing at a
missing id — is the worst outcome: the notes are not deleted, but they are not
findable either.

## Scope

**In:** the delete dialog and the reassignment strategies.

**Out:** the rest of topic management (T-031), Trash (T-034).

## Requirements

**R1.** Deleting a topic **with no notes** deletes immediately with an undo
toast. No dialog — there is nothing to decide.

**R2.** Deleting a topic **with notes** opens a dialog that states the count
plainly — "Delete 'Exodus study'? It has 23 notes." — and offers:

| Option | Effect |
|---|---|
| **Move notes to Uncategorized** (default) | notes keep everything else; `topicId` becomes null |
| **Move notes to another topic** | a picker |
| **Delete the notes too** | notes go to **Trash**, not purged |

**R3.** The destructive option is **not** the default and is not styled as the
primary action.

**R4. "Delete the notes too" trashes them — it does not purge them.** Soft delete
is the only delete in normal use. The notes remain recoverable from Trash for 30
days, which is what makes the whole dialog recoverable from a misclick.

**R5.** The whole operation runs in **one transaction**. A half-deleted topic —
row gone, notes still pointing at it — is the exact failure this task exists to
prevent.

**R6.** Undo restores the topic **and** every note's previous `topicId`. As in
T-027's R6, capture prior state before writing; do not assume every note came
from the deleted topic's id.

**R7.** `repo.js` takes an explicit `strategy` parameter —
`'reassign' | 'move' | 'trash'` — with **no default**. A missing strategy is an
error, not an implicit choice. Forcing the caller to say which prevents a future
surface from silently picking one.

**R8.** The dialog traps focus, returns it on close, and is dismissible with
Escape. Escape cancels — it never deletes.

**R9.** If the deleted topic was the active filter, fall back to All and say so,
rather than showing an empty list.

## Files

- `src/ui/app/topics.js` — the dialog
- `src/ui/app/dialog.js` — the confirm component
- `src/background/repo.js` — `topics/delete` with `strategy`

## Reference

- `work/understandings/extension/02-storage-model.md` — soft delete; Uncategorized
  is `topicId: null`
- `work/understandings/extension/03-messaging.md` — `topics/delete { id, strategy }`
- `work/requirements/EPIC-04-organization/EPIC.md` — the warning policy

## Acceptance

- [ ] Deleting an empty topic needs no dialog and offers undo
- [ ] Deleting a topic with notes shows the **exact** count
- [ ] "Move to Uncategorized" leaves every note intact with `topicId: null`
- [ ] "Move to another topic" reassigns all of them
- [ ] "Delete the notes too" puts them in **Trash**, from which they restore
      with their original topic
- [ ] Undo restores the topic and every note's original `topicId` — including
      notes that had a different one
- [ ] Escape cancels and deletes nothing
- [ ] A failure midway leaves the topic and every note unchanged
- [ ] `topics/delete` without a `strategy` returns an error
- [ ] Deleting the active filter's topic falls back to All with a message

## Notes

R7 is a small API decision with a large effect. Defaults in destructive
operations are how the wrong thing happens quietly, two surfaces later.
