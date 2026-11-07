# T-041 — Lazy rebuild on change

| Field | Value |
|---|---|
| Epic | EPIC-05 Search |
| Status | Not started |
| Depends on | T-036 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

An index that goes stale is worse than no index: the user edits a note, searches
for the words they just typed, and finds nothing. They cannot tell whether the
save failed or search is broken, and both guesses damage trust.

The worker is also not persistent, so the index will vanish and need rebuilding
regardless — which, usefully, means the rebuild path is exercised constantly and
must simply be fast.

## Scope

**In:** keeping the index correct as data changes, cheaply.

**Out:** building it (T-036).

## Requirements

**R1.** Treat the index as a **cache that may be absent**. Every query path must
handle "no index yet" by building one. This is the normal case after any idle
period, not an error path.

**R2. Incremental update for single-record changes.** `repo.js` already knows
which ids changed; re-index just those rather than rebuilding everything. A full
rebuild on every keystroke-debounced autosave is wasteful.

**R3.** Full rebuild on: first query after a cold start, import, bulk operations
above a threshold, and any schema migration.

**R4.** `repo.js` notifies `search.js` **directly, in-process**, rather than
going through `notesRev`. They live in the same worker; a storage round-trip
would be a detour. `notesRev` remains the signal for the **UI** surfaces.

**R5.** Removing a note from the index must remove **all** its tokens, including
ones no longer in the record. Re-indexing an edited note means removing its old
entries first, then adding the new ones — otherwise deleted words stay findable
forever.

**R6.** Trashing a note removes it from the index; restoring re-adds it.

**R7.** Guard against a torn index: if an incremental update throws, drop the
index entirely so the next query rebuilds. A partially-correct index is worse
than none, and this failure mode is otherwise invisible.

**R8.** Instrument it — log rebuild time and index size behind the same debug
flag style as `DEBUG_SCHEDULE`. The question "why is search slow" needs an
answer that is not guesswork.

**R9.** Verify the rebuild target from T-036's R6 (well under 200ms for ~2000
notes) still holds after this task.

## Files

- `src/background/search.js` — invalidation and incremental update
- `src/background/repo.js` — notify on change

## Reference

- `work/understandings/extension/05-mv3-constraints.md` — the worker is not
  persistent; no module-level state survives
- `work/understandings/extension/03-messaging.md` — `notesRev` is for UI
  surfaces, not intra-worker signalling
- `work/understandings/extension/02-storage-model.md`

## Acceptance

- [ ] Editing a note's body makes the new words findable immediately
- [ ] Words **removed** from a note stop being findable
- [ ] Renaming a tag updates search results for both the old and new names
- [ ] Trashing a note removes it from results; restoring brings it back
- [ ] After a worker restart, the first query rebuilds and is correct
- [ ] An import triggers a full rebuild
- [ ] A single-note edit does **not** trigger a full rebuild — verify via the
      debug log
- [ ] A deliberately thrown error during incremental update drops the index, and
      the next query is still correct
- [ ] Rebuild of 2000 notes stays under the target

## Notes

R5 is the subtle one. "Add the new tokens" is the obvious implementation and
leaves every previously-typed word permanently searchable — including text the
user deliberately deleted.
