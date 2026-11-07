# T-043 — JSON export

| Field | Value |
|---|---|
| Epic | EPIC-06 Import and export |
| Status | Not started |
| Depends on | T-042 |
| Blocks | T-046, T-049 |
| Size | S |
| Risk | Low |

## Why

JSON is the format that has to be **exactly right**, because it is both the
round-trip format and the backup. CSV and Markdown are allowed to lose things;
this one is not. If a user restores from a JSON backup and their parallel verse
texts are missing, the backup was a lie.

## Scope

**In:** the JSON writer and its envelope.

**Out:** importing it (T-046), the backup UX (T-049).

## Requirements

**R1.** Envelope:

```json
{
  "app": "bible-boost",
  "kind": "notes-export",
  "schemaVersion": 1,
  "exportedAt": "2026-11-08T00:00:00.000Z",
  "counts": { "notes": 310, "topics": 12, "tags": 44 },
  "topics": [...],
  "tags": [...],
  "notes": [...]
}
```

**R2. Lossless.** Every field of every record, exactly as stored — including
`id`, `createdAt`, `updatedAt`, `source`, `color`, `pinned`, both sides of every
`VerseRef`, and `lang`. Do not prettify, reorder or drop anything, including
fields the current UI does not use.

**R3.** `schemaVersion` is written from `src/shared/schema.js`, never hardcoded.
T-046 uses it to decide whether a migration is needed on import.

**R4.** Include referenced topics and tags **even when the scope is a subset**,
so a single-topic export can be restored into an empty profile without dangling
references.

**R5.** Do **not** include `verseKeys`. It is derived from `verses` and is
recomputed on import (T-005's R3). Exporting it invites an import where the two
disagree.

**R6.** Omit `deletedAt` when null, but keep it when set and the scope is Trash.

**R7.** Indent with two spaces. The file should be diffable and hand-editable —
users will inspect and edit their backups, and a single-line file makes that
hostile.

**R8.** UTF-8, no BOM. JSON parsers reject a BOM in some environments; this is
the opposite of the CSV rule in T-044, and both are deliberate.

**R9.** Verify the round trip as part of this task, not only in T-046: export,
clear, import, and compare field by field.

**R10.** `test/io.test.js` covers the envelope, a note with both verse texts, a
note with no verses, and a Tamil note.

## Files

- `src/background/io.js` — the JSON writer
- `test/io.test.js`

## Reference

- `work/understandings/extension/02-storage-model.md` — **normative** record
  shapes; `verseKeys` is derived
- `work/understandings/bible-com/07-i18n-and-scripts.md` — no BOM for JSON

## Acceptance

- [ ] The envelope matches R1
- [ ] A note with both versions exports both texts, abbreviations and languages
- [ ] Timestamps survive exactly — not reformatted, not rounded
- [ ] A single-topic export includes that topic and every tag its notes use
- [ ] `verseKeys` is absent
- [ ] A Tamil note exports with correct characters and no escaping damage
- [ ] The file is UTF-8 with **no** BOM
- [ ] The file is readable and editable by hand
- [ ] **Round trip:** export → clear all → import → every note identical field by
      field
- [ ] `node --test test/io.test.js` passes

## Notes

Run the round-trip acceptance item with a note that has a parallel version, a
Tamil tag and an empty body. Those three are where field loss hides.
