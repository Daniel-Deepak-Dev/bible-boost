# T-053 — Empty, loading and error states

| Field | Value |
|---|---|
| Epic | EPIC-07 Polish and release |
| Status | Not started |
| Depends on | T-025 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

Every screen in this application has three states besides the happy one, and all
three are easy to leave as a blank area. A blank area is indistinguishable from a
bug — which generates the "my notes disappeared" report that is really "the
filter is still set".

## Scope

**In:** a sweep making every state explicit across both surfaces.

**Out:** individual features' own logic.

## Requirements

**R1. Empty states must distinguish *why* they are empty.** These are different
situations needing different words:

| Situation | Message |
|---|---|
| No notes at all | explain how to create one — the bible.com flow and the standalone "+" |
| No notes in this chapter | say so, and show the counts for book and all (T-023's R3) |
| No search results | suggest widening scope, clearing a filter, checking spelling |
| Filter matches nothing | **name the active filters** and offer to clear them |
| Topic is empty | offer to move notes here, or delete the topic |
| Trash is empty | a plain confirmation, nothing more |

**R2. No loading flash.** Render nothing for the first ~150ms; most queries are
faster, and a skeleton that appears and vanishes reads as broken. Show a
real indicator only past that threshold.

**R3. Error states are actionable, not apologetic.** Say what failed and what to
do: retry, back up, reload.

| Error | Treatment |
|---|---|
| Worker unreachable | explain and offer reload — the worker may have been terminated mid-call |
| IndexedDB blocked | explain that another tab holds an old version; offer to retry (T-003's R7) |
| Save failed | keep the text, show retry, keep the draft (T-030's R4) |
| Quota exceeded | explain, offer export and cleanup |
| Schema newer than the code | explain, and **refuse to write** |

**R4. Never fail silently.** Every `catch` either shows something or logs with
enough context to diagnose. An empty catch block is a bug.

**R5.** Errors never discard user input. Ever.

**R6.** First-run state for the notes page explains what the feature is in two
sentences and points at the bible.com flow.

**R7.** Where the panel cannot do something — no reader page, no selection — say
so with a way forward, rather than showing an inert control.

**R8.** Keep the voice plain and specific. "Could not save — the extension was
reloaded. Your text is safe; press Retry." Not "An error occurred."

**R9.** The error path is **also** a place to mention backup when the error
implies risk — quota exceeded, schema mismatch — linking to T-049.

## Files

- `src/ui/app/*`, `src/ui/panel.js`, `src/ui/notes.js`, `src/ui/ui.css`

## Reference

- `work/requirements/EPIC-06-import-export/T-049-backup-ux.md` — honest
  durability language
- `work/understandings/extension/05-mv3-constraints.md` — the worker is
  terminated routinely; "unreachable" is normal, not exceptional
- `work/understandings/extension/02-storage-model.md` — quota, blocked upgrades

## Acceptance

- [ ] All six empty states in R1 are distinct and correctly worded
- [ ] A filter matching nothing **names the filters** and offers to clear them
- [ ] A fast query shows no loading flash
- [ ] A slow query shows a real indicator
- [ ] Killing the worker mid-save shows the retry path, and the text survives
- [ ] Holding an old database connection in another tab shows the blocked
      message
- [ ] A simulated quota error explains and offers export
- [ ] A database with a newer `schemaVersion` refuses to write and says why
- [ ] No empty `catch` blocks anywhere in the new code
- [ ] First-run state explains the feature
- [ ] No message reads "An error occurred"

## Notes

R3's first row is the one that will actually happen. MV3 terminates the worker
after ~30s idle, so "worker unreachable" is a routine occurrence, not an
exceptional one, and must read as a retry rather than a crash.
