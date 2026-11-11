# B-015 — Trashing nothing returns an undo token that cannot be used

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Found by the review of T-005 |
| Blocks release | No |
| Depends on | T-005 |
| Size | S |
| Risk | Low |

## The problem

`trashNotes` in `src/background/repo.js` skips a note that is already in Trash or is
gone, and returns the ids it really moved as the undo token:

```js
return { ids: changed, value: { undoToken: changed } };
```

When it moved none, that is `undoToken: []`. `restoreNotes` starts with `cleanIds`,
which refuses an empty list with `'No notes were given.'`, on the reasoning that a bulk
action with nothing selected is a bug in the surface that sent it.

Each function is right by its own rule and the two disagree. With two tabs open: trash
a note in tab B, then trash it again from tab A's stale list. Tab A is told the trash
worked and handed `[]`, and its Undo answers `{ok:false, error:'No notes were given.'}`.

`03-messaging.md` does not say what `notes/trash` replies when nothing moved.

## Scope

**In:** what `notes/trash` replies when it moved nothing, and what a surface does with
that reply.

**Out:** `purgeNotes` and `restoreNotes` moving nothing, which hand back no token.

## Requirements

**R1.** A reply to `notes/trash` never carries a token that `notes/restore` would
refuse.

**R2.** A surface can tell "nothing was moved" from "moved, and here is how to undo
it", so that it offers Undo only when there is something to undo.

**R3.** `03-messaging.md` records the reply for the empty case.

## Files

- `src/background/repo.js` — `trashNotes`
- `src/shared/schema.js` — `cleanIds`, only if the decision lands there
- `test/` — a case for whichever rule is chosen, if it is in pure code
- `work/understandings/extension/03-messaging.md`

## Reference

- `work/understandings/extension/03-messaging.md`
- `work/requirements/EPIC-00-foundations/T-005-repo-crud.md` — R5

## Acceptance

- [ ] Trashing a note that is already in Trash gets a reply that offers no Undo
- [ ] Trashing two notes, one already in Trash, gets a token that restores the other
- [ ] `node --test` passes

## Notes

**The same no-op also sends a change signal (2026-11-10 review, checked 2026-11-11).**
`mutate()` calls `bumpRev(kind, outcome.ids)` after every write, and `bumpRev` does not
look at `ids`. So a `notes/trash` that moved nothing still increments `notesRev`, and so
do a `notes/restore` or `notes/purge` that moved nothing. Every open surface then reloads
its list for a change that did not happen. It is harmless, only wasted work, and it is
not one of this file's requirements. Whoever settles R2 is deciding what "moved nothing"
looks like, and is best placed to decide whether it should skip the bump too.

**Do not skip the bump on an empty `ids` in `mutate()`.** `ids` names the notes whose
records changed, not whether anything did. `createTopic` and `updateTopic` return
`ids: []` on purpose, and so does `renameTag` when only a tag's label changes, and the
surfaces still have to hear about those. A skip has to come from the three operations
that move notes, where an empty `changed` really does mean nothing happened.
