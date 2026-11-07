# T-012 — Localized reference capture

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Not started |
| Depends on | T-008 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

`EXO.13.2` is the right thing to **store** — it is stable across versions and
languages, which is exactly what makes a Tamil note and an English note about the
same verse linkable forever.

It is the wrong thing to **show**. A user reading Tamil expects to see the Tamil
book name, as bible.com shows it. The codebase has no book-name table in any
language and should not grow one: that is a translation project, and the page
already has the answer.

## Scope

**In:** reading the localized reference string off the page and storing it
alongside the canonical key.

**Out:** building any book-name table, parsing a localized name back into a book
code, or formatting ranges (T-016).

## Requirements

**R1.** `BB.capture.displayRef(usfm, col) -> string | null`, with this chain:

1. The verse menu's header line, which shows the selected reference. Strip the
   trailing version abbreviation.
2. The chapter heading rendered at the top of the column, plus the verse number
   read from the verse's own direct-child `_label`.
3. `null`.

**R2.** Store it as `VerseRef.displayRef`. It is **display only**. Nothing may
parse it, match on it, or derive a book from it.

**R3.** Capture it **per column**, because the two columns are in different
languages. The Tamil column gives the Tamil rendering; the English column gives
"Exodus 13:2".

**R4.** `null` is acceptable and must be handled. Every consumer falls back to
formatting the canonical `usfm` through `src/shared/refs.js`.

**R5.** Normalize to NFC, the same as verse text.

**R6.** Do not cache a `displayRef` across chapters or versions. It is specific
to the verse, the version and the interface language, any of which can change
without a page load.

## Files

- `src/content/capture.js`

## Reference

- `work/understandings/bible-com/07-i18n-and-scripts.md` — localized names live
  only in the page; never parse one to derive a book
- `work/understandings/bible-com/06-verse-action-menu.md` — the header line
  format, **unverified**
- `work/understandings/bible-com/02-verse-dom.md` — the direct-child `_label` is
  the verse number

## Acceptance

- [ ] Selecting Exodus 13:2 in TAOVBSI captures the Tamil rendering of the
      reference, without the trailing `TAOVBSI`
- [ ] The same verse in the NKJV column captures `Exodus 13:2`
- [ ] Switching the site's interface language changes what is captured, and the
      stored `usfm` is unaffected
- [ ] With the menu suppressed (saving via `Alt+N`), fallback 2 produces a
      sensible reference
- [ ] When nothing can be read, the note still saves and the UI shows a reference
      formatted from the `usfm`
- [ ] `displayRef === displayRef.normalize('NFC')`

## Notes

The separation here is the whole point: **`usfm` is the key, `displayRef` is the
caption.** If any later code starts matching on `displayRef`, that is a bug — it
will break the moment the user changes interface language.
