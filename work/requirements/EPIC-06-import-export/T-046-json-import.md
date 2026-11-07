# T-046 — JSON import with dry-run diff

| Field | Value |
|---|---|
| Epic | EPIC-06 Import and export |
| Status | Not started |
| Depends on | T-043, T-048 |
| Blocks | — |
| Size | M |
| Risk | Medium — the one path that can overwrite existing notes |

## Why

This closes the backup loop. It is also the only operation in the application
that can overwrite notes the user did not just edit, which is why it gets a
preview rather than a confirm dialog: "Import 310 notes?" tells the user nothing
about what they are about to lose.

## Scope

**In:** parsing, previewing, merge strategies, applying.

**Out:** validation (T-048), CSV (T-047).

## Requirements

**R1.** Two steps: `io/importPreview` returns a diff and changes nothing;
`io/import` applies a chosen strategy. The UI must make the preview unskippable.

**R2.** The diff classifies every record:

| Class | Meaning |
|---|---|
| **New** | the id is not present |
| **Identical** | present, every field equal |
| **Conflicting** | present, differs — show which fields, and both `updatedAt` values |
| **Invalid** | failed T-048 |

Show counts per class and let the user inspect the conflicting ones.

**R3. Strategies**, chosen once for the whole import:

| Strategy | Behaviour |
|---|---|
| **Skip existing** (default) | import only New |
| **Overwrite** | file wins on conflicts |
| **Keep newer** | compare `updatedAt`, newest wins |
| **Duplicate** | import everything with fresh ids |

Default to the non-destructive one.

**R4.** Topics and tags merge **by normalized name**, not by id — two profiles
will not share ids. A topic whose name matches an existing one reuses it; a new
one is created. Report what was created.

**R5.** A note whose `topicId` refers to a topic not in the file and not in the
database lands in Uncategorized, and is reported. Never leave a dangling
reference.

**R6. Recompute `verseKeys`** from `verses`. Never take it from the file
(T-048's R8).

**R7.** Apply in **one transaction**, or in bounded batches each of which is
atomic. A half-applied import is the worst outcome — the user cannot tell what
state they are in, and running it again may duplicate.

**R8.** Trigger a **full search-index rebuild** afterwards (T-041's R3).

**R9.** Bump `notesRev` **once** for the whole import, not per note.

**R10.** Report a summary afterwards: created, updated, skipped, invalid, with
the topics and tags created. Offer to open the imported set as a filtered view.

**R11.** Importing into a **non-empty** database warns clearly, naming the
strategy's effect in plain words — "This will overwrite 12 existing notes."

**R12.** If the file's `schemaVersion` is older, migrate the records through the
same ladder as T-003 before validating.

## Files

- `src/background/io.js` — parse, diff, apply
- `src/ui/app/io-ui.js` — the preview UI
- `background.js` — `io/importPreview`, `io/import`
- `test/import.test.js`

## Reference

- `work/requirements/EPIC-06-import-export/T-048-import-validator.md`
- `work/understandings/extension/02-storage-model.md` — `verseKeys` derived;
  migrations
- `work/understandings/extension/03-messaging.md` — the import messages

## Acceptance

- [ ] Preview changes nothing — verify the database is untouched after it
- [ ] The diff classifies New, Identical, Conflicting and Invalid correctly
- [ ] Conflicting records show which fields differ, and both timestamps
- [ ] Skip existing imports only new notes
- [ ] Overwrite replaces, Keep newer compares timestamps, Duplicate creates fresh
      ids
- [ ] A topic matching an existing one by name is reused, not duplicated
- [ ] A note referencing a missing topic lands in Uncategorized and is reported
- [ ] `verseKeys` is recomputed, even if the file supplied wrong ones
- [ ] A failure midway leaves the database unchanged
- [ ] Search finds imported notes immediately
- [ ] `notesRev` bumps once
- [ ] **Full round trip:** export → clear all → import → identical field by field
- [ ] An older `schemaVersion` file imports via the migration ladder

## Notes

R3's default matters. The destructive strategy must be a deliberate choice, and
R11 must spell out its effect in a sentence, not a format name.
