# T-044 — CSV export

| Field | Value |
|---|---|
| Epic | EPIC-06 Import and export |
| Status | Not started |
| Depends on | T-042 |
| Blocks | T-047 |
| Size | S |
| Risk | Medium — the encoding trap is near-certain if not handled |

## Why

CSV is for spreadsheets — sorting, filtering, sharing a study with someone who
does not use this extension. It is inherently lossy: a flat grid cannot hold a
note with an arbitrary number of verses, each with two version texts.

The job is to lose the right things, predictably, and to get the encoding right.

## Scope

**In:** the CSV writer, its column design, and encoding.

**Out:** importing (T-047).

## Requirements

**R1.** One row per note. Columns:

```
id, title, topic, tags, refs, displayRefs,
primaryVersion, primaryText, parallelVersion, parallelText,
body, pinned, createdAt, updatedAt
```

**R2.** Multi-valued fields join with `; ` — tags, refs, and the per-verse texts.
Document this in a header comment row, or in the UI, so the convention is not
guesswork on import.

**R3. UTF-8 with a BOM** (`﻿` prefix). Without it, Excel on Windows opens
the file in the system ANSI codepage and Tamil renders as mojibake. **This is the
single most likely bug in this task** and it will not be visible to anyone
testing with English-only data.

This is deliberately the opposite of T-043's JSON rule.

**R4. RFC 4180 quoting**, correctly:

- wrap a field in `"` if it contains a comma, a quote, CR or LF
- escape an embedded `"` by doubling it
- **a note body contains newlines** — this is the normal case, not an edge case,
  and a naive writer produces a broken file on the first multi-line note

**R5.** Line endings `\r\n`, per the RFC and for Excel's benefit.

**R6.** Timestamps as ISO 8601 strings. Do not let a spreadsheet guess — and be
aware that Excel may still reinterpret them on open; that is the user's problem
to format, not ours to pre-break.

**R7.** `id` is included so a CSV round-trip can match existing notes rather than
duplicating them (T-047).

**R8.** A note with several verses joins its refs and texts in the same order, so
the columns stay aligned by index. A note with no parallel version leaves those
cells empty, not `null` or `undefined` as text.

**R9.** `test/csv.test.js` covers: a body with newlines, a body with quotes, a
body with commas, a Tamil body, an empty field, and the BOM.

## Files

- `src/background/io.js` — the CSV writer
- `test/csv.test.js` — new

## Reference

- `work/understandings/bible-com/07-i18n-and-scripts.md` — **the BOM rule**
- `work/understandings/extension/02-storage-model.md` — record shapes

## Acceptance

- [ ] A note with a multi-line body produces a valid, parseable row
- [ ] A body containing `"` and `,` round-trips through a CSV parser
- [ ] The file begins with a BOM
- [ ] **Opened in Excel on Windows, Tamil renders correctly** — actually open it
- [ ] It also opens correctly in Google Sheets and LibreOffice
- [ ] A multi-verse note keeps refs and texts aligned by index
- [ ] A note with no parallel version has empty cells, not the string "undefined"
- [ ] Line endings are `\r\n`
- [ ] `node --test test/csv.test.js` passes all six cases

## Notes

The fourth acceptance item requires actually opening Excel. Every other check
can pass while the file is unreadable to the person it was exported for.
