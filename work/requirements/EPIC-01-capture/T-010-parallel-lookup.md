# T-010 — Parallel column text lookup

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Not started |
| Depends on | T-001, T-009 |
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

- [ ] On `/bible/339/EXO.13.TAOVBSI?parallel=114`, verse `EXO.13.2` returns Tamil
      as primary (`339`, `TAOVBSI`, `tam`) and English as parallel (`114`,
      `NKJV`, `eng`)
- [ ] Reversing the URL so NKJV is primary swaps the two sides correctly
- [ ] On a single-version page, `parallel` is `null` and `primary` is populated
- [ ] Narrowing the window until bible.com hides the second column yields
      `parallel: null` rather than a stale or wrong text
- [ ] A verse missing from the parallel version yields `parallel: null`
- [ ] An unknown version id still saves, with `abbr` falling back to the id

## Notes

This is the task that makes the parallel-capture decision pay off. Check the
swapped-URL case explicitly — assuming A is primary is the obvious bug here and
it will look correct in the common configuration.
