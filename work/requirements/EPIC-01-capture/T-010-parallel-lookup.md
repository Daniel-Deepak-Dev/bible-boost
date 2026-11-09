# T-010 — Parallel column text lookup

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Done |
| Depends on | T-001, T-009, T-011 |
| Blocks | T-016 |
| Size | S |
| Risk | Low |

## Why

The decision was made to capture **both** versions' text on every saved verse.
The user reads Tamil and English side by side, so a note holding only one of them
is half a note — and reopening bible.com to see the other defeats the purpose.

This is nearly free because `data-usfm` is identical across versions and columns,
and `BB.dom.firstSpans()` already builds a per-column `usfm -> element` map.

## Scope

**In:** resolving one usfm into a primary and a parallel text pair.

**Out:** the `VerseRef` record assembly (T-014 does that, calling this).

## Requirements

**R1.** `BB.capture.versePair(usfm) -> { primary, parallel }` where each side is
`{ versionId, abbr, lang, text }` and `parallel` is `null` when not in parallel
mode or when the verse is absent from the other column.

**R2.** Identify which column is primary by comparing each column's `vid` token
against `BB.dom.parseUrl().id`. **Do not assume DOM order.**
`const [A, B] = cols.map(firstSpans)` is document order, not primary/parallel
order.

**R3.** Use `BB.dom.columns()`, which returns null unless **two columns are
visible**. "Parallel is in the URL" and "two columns are on screen" are different
facts — bible.com hides the second column on narrow screens, where
`getClientRects()` is empty.

**R4.** A verse present in one column may be **absent from the other** — versions
differ in versification, and some render combined verses. Return `null` for that
side rather than an empty string, so a consumer can tell "no parallel" from
"parallel exists but is blank".

**R5.** Get `abbr` and `lang` from T-011. Never fail a save because an
abbreviation could not be resolved — fall back to the raw numeric id.

**R6.** Get the text from T-009's `verseText`, per column.

## Files

- `src/content/capture.js`

## Reference

- `work/understandings/bible-com/03-columns-and-versions.md` — the `vid` and
  `iso6393` tokens, visibility, and the warning about column order
- `work/understandings/bible-com/02-verse-dom.md` — `data-usfm` as a
  cross-version key
- `work/understandings/extension/02-storage-model.md` — the `VerseRef` shape

## Acceptance

- [x] On `/bible/339/EXO.13.TAOVBSI?parallel=114`, verse `EXO.13.2` returns Tamil
      as primary (`339`, `TAOVBSI`, `tam`) and English as parallel (`114`,
      `NKJV`, `eng`)
- [x] Reversing the URL so NKJV is primary swaps the two sides correctly
- [x] On a single-version page, `parallel` is `null` and `primary` is populated
- [x] Narrowing the window until bible.com hides the second column yields
      `parallel: null` rather than a stale or wrong text
- [x] A verse missing from the parallel version yields `parallel: null`
- [x] An unknown version id comes back with `abbr` falling back to the id, and
      `cleanNoteDraft` accepts such a side (there is no save path to run until
      T-014)
- [x] Loaded unpacked in Chrome, `BB.capture.versePair('EXO.13.2')` from the
      BibleBoost console context gives the expected pair, and the standing
      regression check in CLAUDE.md passes

## Notes

This is the task that makes the parallel-capture decision pay off. Check the
swapped-URL case explicitly — assuming A is primary is the obvious bug here and
it will look correct in the common configuration.

*Corrected during the work.* The swapped-URL case does not catch that bug. bible.com
renders the URL's primary first on a swapped URL too, so code taking the first column
passes it. The vid comparison is still what R2 requires, but no check available today
can tell the two apart.

`primary` can be null as well as `parallel`, because R4 says "that side". `cleanSide`
refuses a null primary, so T-014 has to decide what such a verse does.

### How the ticked items were verified

On live bible.com on 2026-11-10, logged out, in the Claude desktop app's browser
pane. That browser cannot load an unpacked extension, so the code path from
`bible-dom.js`, `versions.js` and `capture.js` was pasted into the page with
comments, logging and unrelated functions removed. `pairSide` and `versePair` went in
as written. Pages were reached with `next.router.push`, so the same injected code
answered on every page.

| Page | Verse | Primary | Parallel |
|---|---|---|---|
| `/bible/339/EXO.13.TAOVBSI?parallel=114` | `EXO.13.2` | 339, TAOVBSI, tam | 114, NKJV, eng |
| `/bible/114/EXO.13.NKJV?parallel=339` | `EXO.13.2` | 114, NKJV, eng | 339, TAOVBSI, tam |
| `/bible/339/EXO.13.TAOVBSI` | `EXO.13.2` | 339, TAOVBSI, tam | `null` |
| `/bible/114/ROM.1.NKJV?parallel=392` | `ROM.1.3`, `ROM.1.5` | 114, NKJV, eng | 392, CEV, eng |
| same page | `ROM.1.4` | 114, NKJV, eng | `null` |
| `/bible/114/MAT.17.NKJV?parallel=111` | `MAT.17.21` | 114, NKJV, eng | 111, NIV, `null`, text `''` |

The NKJV text of `EXO.13.2` began with the verse itself and held no footnote text.

**Narrowing.** On an open parallel page, stepping an emulated viewport down from
1600px, both columns stayed through 640px. At 600px bible.com had removed `?parallel=`
and the second column, and `versePair` gave `parallel: null` with the primary intact.

**Forced states**, on the parallel Exodus page, each undone straight after reading:

| Change | Result |
|---|---|
| `display:none` on the second column | primary 339, parallel `null` |
| `display:none` on the first column | primary 339, parallel `null` |
| first column's class changed to `vid999999`, so the URL's id names no column | both `null` |
| second column's class changed to `vid888888` | parallel `888888` / `888888`, text intact |

The live page never produced the first three by itself. Sampling `versePair` every
25 ms across three client-side navigations never caught the URL and the columns
disagreeing.

Nothing saves a note until T-014, so the "still saves" half is the existing test in
`test/schema.test.js` that runs a resolved-by-nothing side through `cleanNoteDraft`.

### The box checked by hand

This needed the extension loaded, because injection cannot cover the manifest's load
order, the isolated world, or alignment still working. Done by hand with the unpacked
extension in Chrome on 2026-11-10, on `/bible/339/EXO.13.TAOVBSI?parallel=114`: the
console call logged version 339 answered by `url`, then 114 by `link`, and returned
the expected pair. The standing regression check passed, including `Alt+P/A/S` and
re-aligning after an "Aa" size change.

Not checked: a signed-in session and a non-English interface language.
