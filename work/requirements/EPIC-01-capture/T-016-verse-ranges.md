# T-016 — Multi-verse range capture

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Not started |
| Depends on | T-008, T-009, T-010 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

bible.com lets a reader select a range, and a study note is at least as often
about a passage as about a single verse. The data model already anticipates this
— a note holds `verses[]`, not one verse.

The only genuinely new work is formatting: a note about five verses should be
captioned `Exodus 13:2-6`, not five separate labels.

## Scope

**In:** turning a multi-verse selection into one note, and formatting the
caption.

**Out:** letting the user add verses to an **existing** note (EPIC-03, bulk and
editing work).

## Requirements

**R1.** A multi-verse selection creates **one** note with one `VerseRef` per
verse, each carrying its own primary and parallel text. Not one note per verse.

**R2.** `src/shared/refs.js` gains `formatRange(usfms) -> string`, collapsing
contiguous runs and joining gaps with commas:

```
['EXO.13.2','EXO.13.3','EXO.13.4']          -> 'EXO.13.2-4'
['EXO.13.2','EXO.13.4']                      -> 'EXO.13.2,4'
['EXO.13.2','EXO.13.3','EXO.14.1']           -> 'EXO.13.2-3; EXO.14.1'
```

This is a pure function and is covered by `node --test`.

**R3.** A selection can **span a chapter boundary**. Group by book and chapter,
then collapse within each group. Do not assume one chapter.

**R4.** Verses are stored in **canonical order** — book index, then chapter, then
verse — regardless of the order they were selected in. Never alphabetical by
book code: `1CO` before `ACT` is wrong.

**R5.** The caption prefers localized `displayRef` strings when every verse has
one, falling back to the canonical formatting. For a range, build it from the
first and last `displayRef` rather than concatenating all of them.

**R6.** `verseKeys` contains every verse's key, so a search or filter for any
single verse in the range finds the note. This happens in `repo.js` (T-005) —
verify it works for ranges, do not reimplement it here.

**R7.** Guard against an absurd selection — "select whole chapter" would produce
a 176-verse note in Psalm 119. Above a threshold (suggest 50), warn and confirm
before saving rather than refusing.

## Files

- `src/shared/refs.js` — `formatRange`, canonical book order
- `src/content/capture.js` — multi-verse draft assembly
- `test/refs.test.js` — range collapsing cases

## Reference

- `work/understandings/bible-com/02-verse-dom.md` — document order,
  combined-verse keys
- `work/understandings/extension/02-storage-model.md` — `verses` and `verseKeys`
- `work/understandings/bible-com/07-i18n-and-scripts.md` — canonical ordering,
  never alphabetical

## Acceptance

- [ ] Selecting Exodus 13:2-4 creates one note with three `VerseRef`s
- [ ] Each one carries both versions' text
- [ ] The caption reads as a collapsed range, not three labels
- [ ] A non-contiguous selection renders with commas
- [ ] A selection spanning a chapter boundary groups correctly
- [ ] Selecting verses out of order stores them in canonical order
- [ ] `listNotes({filter:{verseKey:'EXO.13.3'}})` finds a note saved as 13:2-4
- [ ] Selecting more than 50 verses prompts before saving
- [ ] `node --test test/refs.test.js` covers all the R2 cases plus the
      cross-chapter case

## Notes

Psalm 119 is the test case for R7, and `1CO` versus `ACT` is the test case for
R4. Both are cheap to check and both are easy to get wrong.
