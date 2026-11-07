# T-047 — CSV import, best effort

| Field | Value |
|---|---|
| Epic | EPIC-06 Import and export |
| Status | Not started |
| Depends on | T-044, T-048 |
| Blocks | — |
| Size | M |
| Risk | Medium — CSV parsing is deceptively hard |

## Why

CSV import is how notes arrive from **somewhere else** — a spreadsheet the user
already keeps, another app's export, a shared study. JSON import handles
BibleBoost's own backups; this handles everyone else's data.

It is explicitly **best effort**. A flat grid cannot carry everything, and the
honest design is to import what is there, report what could not be understood,
and never silently invent.

## Scope

**In:** parsing CSV, mapping columns, creating missing topics and tags.

**Out:** JSON import (T-046), validation (T-048).

## Requirements

**R1. Write a correct CSV parser.** `split(',')` is wrong on the first quoted
field and wrong on the first multi-line body — which is the normal case for
notes. Handle: quoted fields, doubled `""` escapes, embedded commas, embedded
CRLF, and a leading BOM (strip it).

`test/csv.test.js` covers the parser, not just the writer.

**R2. Column mapping UI.** Do not assume BibleBoost's own column order. Read the
header row, let the user map columns to fields, and pre-fill the mapping when the
headers match T-044's output. A foreign CSV is the main use case.

**R3.** Required mapping: at minimum a body or a ref. Everything else optional.

**R4.** Rows with an `id` matching an existing note follow T-046's strategies.
Rows with no id, or an unknown one, are new notes with fresh ids.

**R5. Topics match by name** and are created when missing. Tags likewise,
normalized via `normalize.js`. Report everything created, so an import that
invents 40 tags from a bad mapping is visible rather than discovered later.

**R6.** Split multi-valued fields on `; `, per T-044's R2, and let the user
override the separator — another tool will have used a comma or a pipe.

**R7.** A ref column is parsed through `src/shared/refs.js`. An unparseable ref
means the note imports **without** verses and is reported — do not guess, and do
not drop the note.

**R8. Verse text cannot be recovered** for a ref that has no text column. Import
the note with the ref and an empty text, clearly reported. Never fabricate verse
text, and never fetch it — there is no network permission and inventing scripture
text is not acceptable.

**R9.** Preview before applying, exactly as T-046: counts, a sample of parsed
rows, and every problem.

**R10.** Everything goes through T-048 before it reaches the database.

**R11.** Full index rebuild and a single `notesRev` bump, as T-046.

**R12.** A row that cannot be parsed at all is skipped with its line number
reported, and does not abort the import.

## Files

- `src/background/io.js` — the CSV parser and importer
- `src/ui/app/io-ui.js` — the mapping UI
- `test/csv.test.js`

## Reference

- `work/requirements/EPIC-06-import-export/T-044-csv-export.md` — the column
  convention and separator
- `work/requirements/EPIC-06-import-export/T-048-import-validator.md`
- `work/understandings/bible-com/07-i18n-and-scripts.md` — BOM handling,
  normalization

## Acceptance

- [ ] A BibleBoost CSV round-trips: export, clear, import, notes restored
- [ ] A body containing commas, quotes and newlines parses correctly
- [ ] A file with a BOM parses, and the BOM does not end up in the first field
- [ ] A foreign CSV with different headers can be mapped by hand
- [ ] Missing topics and tags are created and reported
- [ ] An unparseable ref imports the note without verses, and reports it
- [ ] A ref with no text column imports with empty text, reported — **no
      fabricated scripture**
- [ ] A malformed row is skipped with its line number, and the rest import
- [ ] Preview changes nothing
- [ ] Search finds imported notes immediately
- [ ] `node --test test/csv.test.js` covers parser cases, not only writer cases

## Notes

R1 is the whole task's difficulty. Write the parser against the test cases
first; a parser that works on the happy path will fail on the first real note
with a line break in it.
