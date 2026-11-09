# T-012 — Localized reference capture

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Done |
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

*Corrected during the work.* Step 1 cannot answer for every verse. The header names
the primary version only and speaks for the whole selection, so it counts only when
its `href` names this column's version and exactly this verse. The parallel column, a
multi-verse selection and CEV's combined verses all go to step 2.

**R2.** Store it as `VerseRef.displayRef`. It is **display only**. Nothing may
parse it, match on it, or derive a book from it.

**R3.** Capture it **per column**, because the two columns are in different
languages. The Tamil column gives the Tamil rendering; the English column gives
"Exodus 13:2".

**R4.** `null` is acceptable and must be handled. Every consumer falls back to
formatting the canonical `usfm` through `src/shared/refs.js`.

**R5.** Normalize to NFC, the same as verse text.

**R6.** Do not cache a `displayRef` across chapters or versions. It is specific
to the verse and the version, either of which can change without a page load.

*Corrected during the work.* This also named the interface language, which does not
affect the reference. `07-i18n-and-scripts.md` records the measurement.

## Files

- `src/content/capture.js`

## Reference

- `work/understandings/bible-com/07-i18n-and-scripts.md` — localized names live
  only in the page; never parse one to derive a book
- `work/understandings/bible-com/06-verse-action-menu.md` — the header line
  format, verified during T-008
- `work/understandings/bible-com/02-verse-dom.md` — the direct-child `_label` is
  the verse number

## Acceptance

- [x] Selecting Exodus 13:2 in TAOVBSI captures the Tamil rendering of the
      reference, without the trailing `TAOVBSI`
- [x] The same verse in the NKJV column captures `Exodus 13:2`
- [x] Changing the version changes what is captured. Switching the site's interface
      language does not, and the `usfm` is unaffected
- [x] With the menu not answering (nothing selected, or several verses), fallback 2
      produces a sensible reference. `Alt+N` itself arrives in T-015
- [x] When nothing can be read, `displayRef` returns `null` and `cleanNoteDraft`
      accepts it. Showing a reference from the `usfm` belongs to T-014 R1 and
      T-021 R4, since there is no UI until then
- [x] `displayRef === displayRef.normalize('NFC')`
- [x] Loaded unpacked in Chrome, `BB.dom.columns().map((c) =>
      BB.capture.displayRef('EXO.13.2', c))` from the BibleBoost console context gives
      the Tamil and English references
- [x] With the extension loaded, the standing regression check in CLAUDE.md passes,
      and `BB.capture.getSelection()` still names a tapped verse

## Notes

The separation here is the whole point: **`usfm` is the key, `displayRef` is the
caption.** If any later code starts matching on `displayRef`, that is a bug — it
will break the moment the same verse is saved from another version.

### How the ticked items were verified

On live bible.com on 2026-11-10, logged out, at a 1600px viewport. The browser used
cannot load an unpacked extension, so `displayRef`, its helpers, `readMenu` and the
`bible-dom.js` readers they use were pasted into each page with comments removed.

| Page | Selected | Primary column | Other column |
|---|---|---|---|
| `/bible/339/EXO.13.TAOVBSI?parallel=114` | 13:2 | `யாத்திராகமம் 13:2`, menu | `Exodus 13:2`, heading |
| `/bible/114/EXO.13.NKJV?parallel=339` | 13:2 | `Exodus 13:2`, menu | `யாத்திராகமம் 13:2`, heading |
| `/de/bible/114/EXO.13.NKJV?parallel=339` | 13:2 | `Exodus 13:2`, menu | `யாத்திராகமம் 13:2`, heading |
| `/ta/bible/339/EXO.13.TAOVBSI?parallel=114` | 13:2 | `யாத்திராகமம் 13:2`, menu | `Exodus 13:2`, heading |
| `/bible/111/MAT.17` | 17:21 | `Matthew 17:21`, menu | |
| `/bible/392/ROM.1.CEV?parallel=114` | 1:3 | `Romans 1:3-4`, heading | `Romans 1:3`, heading |
| `/bible/114/JUD.1.NKJV` | 1:3 | `Jude 1:3`, menu | |

With nothing selected, every row gave the same strings from the heading. With 13:2 and
13:3 both selected, each verse got its own caption from the heading. Every result
equalled its own NFC form.

`null` came back for `EXO.14.2` on an Exodus 13 page, for `EXO.13.99`, and for
`ROM.1.4` in the CEV column, which has no such key, while NKJV beside it gave
`Romans 1:4`. A `null` column, `{}`, an element with no vid token and a detached column
each returned `null` without throwing. `cleanNoteDraft` stored `displayRef: null` as
`''`, run once from Node.

`readMenu` was refactored here, and read the same verses as before: `EXO.13.2`, then
`EXO.13.2` and `EXO.13.3`, `ROM.1.3` for the combined verse, and `null` with nothing
selected.

The last two boxes were done by hand in Chrome with the unpacked extension on
2026-11-10, on `/bible/339/EXO.13.TAOVBSI?parallel=114`. The console call returned
`யாத்திராகமம் 13:2` and `Exodus 13:2`. With 13:2 tapped in the left column,
`BB.capture.getSelection()` returned `usfms: ['EXO.13.2']` from `class`, so the real
observer path still learns the class. The standing regression check passed.

Not checked: the branch where the header does not end with the abbreviation, which no
live page produced; a signed-in session; a phone-width layout.
