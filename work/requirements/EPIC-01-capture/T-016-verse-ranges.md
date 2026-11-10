# T-016 — Multi-verse range capture

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Done |
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

**R2.** `formatRange(usfms) -> string` in `src/shared/refs.js`, already written
and tested by T-007, collapses contiguous runs and joins gaps with commas:

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

*Corrected during the work.* Nothing may parse a `displayRef` (T-012 R2), so the last
one is not read. The first verse of each chapter keeps its `displayRef` with its own
number cut off the end, as the heading, and every other number comes from the `usfm`.
If any verse's reference does not end in that verse's own number, the whole caption
takes the canonical form. A lone verse keeps its `displayRef` whole.

**R6.** `verseKeys` contains every verse's key, so a search or filter for any
single verse in the range finds the note. This happens in `repo.js` (T-005) —
verify it works for ranges, do not reimplement it here.

**R7.** Guard against an absurd selection — "select whole chapter" would produce
a 176-verse note in Psalm 119. Above a threshold (suggest 50), warn and confirm
before saving rather than refusing.

*Decided during the work.* The threshold is 50, so exactly 50 does not ask. Save shows
the count inside the popover and a second press goes ahead. `window.confirm` was
rejected because it stops the page and is labelled "www.bible.com says".

## Files

- `src/shared/refs.js` — `formatRange` and `compareUsfm` exist since T-007
- `src/shared/schema.js` — R4's sort, in `cleanNoteFields`
- `src/content/save-popover.js` — `captionOf` for R5, and R7's guard in `save()`
- `test/refs.test.js` — the R2 and cross-chapter cases exist since T-007
- `test/schema.test.js`, `test/save-popover.test.js`

*Corrected during the work.* This listed `src/content/capture.js` for multi-verse draft
assembly, but T-014 put that in `save-popover.js`, and R1 needed no change there.

## Reference

- `work/understandings/bible-com/02-verse-dom.md` — document order,
  combined-verse keys
- `work/understandings/extension/02-storage-model.md` — `verses` and `verseKeys`
- `work/understandings/bible-com/07-i18n-and-scripts.md` — canonical ordering,
  never alphabetical

## Acceptance

- [x] Selecting Exodus 13:2-4 creates one note with three `VerseRef`s
- [x] Each one carries both versions' text
- [x] The caption reads as a collapsed range, not three labels
- [x] A non-contiguous selection renders with commas
- [x] A selection spanning a chapter boundary groups correctly
- [x] Selecting verses out of order stores them in canonical order
- [x] `listNotes({filter:{verseKey:'EXO.13.3'}})` finds a note saved as 13:2-4
- [x] Selecting more than 50 verses prompts before saving
- [x] `node --test test/refs.test.js` covers all the R2 cases plus the
      cross-chapter case

## Notes

Psalm 119 is the test case for R7, and `1CO` versus `ACT` is the test case for
R4. Both are cheap to check and both are easy to get wrong.

`refs.js` is an ES module and `capture.js` is a classic script, so `capture.js`
cannot import `compareUsfm`. R4's sort has to happen in the worker, which also
fits the rule that content scripts send raw drafts.

The caption has the same problem and cannot be solved the same way, because the popover
needs it before anything is sent. `captionOf` in `save-popover.js` is a second copy of
`formatRange` with a localized heading, and `test/save-popover.test.js` runs both over
the same keys so that they cannot drift. T-021 R4 needs this rule for a saved note. It
is a module, so it should add the rule to `refs.js` then, since nothing calls it there
yet.

### The check in real Chrome

Done by hand on 2026-11-10 with the extension installed, on
`/bible/339/EXO.13.TAOVBSI?parallel=114`. Exodus 13:2-4 was saved from the menu row with
a topic, a tag and a body. `notes/list` with `verseKey: 'EXO.13.3'` read it back as one
note with three verses, each with its `displayRef` and both versions' text, and all three
in `verseKeys`.

That save went through the real service worker, so `schema.js` bringing `refs.js` and
`versions.js` into it does not stop it starting. The built-in browser refuses
`navigator.serviceWorker.register`, so nothing else could have shown that.

The standing regression check passed by hand the same day. `Alt+P/A/S` remain under
B-006.

### How the boxes were verified

On real bible.com pages on 2026-11-10, logged out, at 1400x900, through the local proxy
in `conventions/03-task-workflow.md`, with Footnotes off. The real content scripts saved
through the real `background.js`, router and `repo.js` into real IndexedDB. Taps were
`verseEl.click()`.

| Page | Selected | Caption | bible.com's header, less the version |
|---|---|---|---|
| `/bible/339/EXO.13.TAOVBSI?parallel=114` | 13:2-4 | `யாத்திராகமம் 13:2-4` | the same |
| The same | 13:2 and 13:4 | `யாத்திராகமம் 13:2,4` | the same |
| `/bible/114/EXO.13.NKJV?parallel=339` | 13:2-4 | `Exodus 13:2-4` | the same |
| `/bible/392/ROM.1.CEV?parallel=114` | 1:3, the combined verse | `Romans 1:3-4` | the same |
| The same | 1:1-2 | `Romans 1:1-2` | the same |
| The same | 1:3 and 1:5 | `ROM.1.3,5` | `Romans 1:3-5` |
| `/bible/339/PSA.119.TAOVBSI?parallel=114` | all 176 | `சங்கீதம் 119:1-176` | the same |
| NKJV Exodus 13, Numbers and Titles off | 13:3-4 | `EXO.13.3-4` | `Exodus 13:3-4` |

The last two differences are the canonical fallback doing what R5 asks. A combined verse
inside a range is keyed by its first number, so the caption shows a gap that bible.com
does not. The last row is the effect B-011 predicted from reading the code.

- **Order.** Tapping 4, then 2, then 3 stored 2, 3, 4. A draft sent as `1CO.1.1`,
  `EXO.13.10`, `ACT.1.1`, `EXO.13.2` came back as `EXO.13.2`, `EXO.13.10`, `ACT.1.1`,
  `1CO.1.1`. A real selection can also arrive out of order: a text range from the left
  column's 13:21 into the right column's 13:2 gave `getSelection` 21, 22, 1, 2, and the
  caption read `யாத்திராகமம் 13:1-2,21-22`.
- **R6.** `notes/list` with `verseKey: 'EXO.13.3'` found the note saved as 13:2-4, and
  `verseKey: 'PSA.119.100'` found the 176-verse note.
- **R7.** Psalm 119 with 50 selected saved with no question. With 51, the first press
  warned and stored nothing, and the second saved. With 176, by Ctrl+Enter, the first
  press warned, three `repeat` key events did nothing, and the next press saved 176
  verses and 176 keys in order, both sides present.
- **Cost.** Reading all 176 verses took 258 ms and opening the popover 330 ms, and the
  stored note was 71 KB.

A selection across a chapter boundary cannot be made on a live page, because the reader
shows one chapter. That box rests on `formatRange` and `captionOf` in Node. `displayRef`
answers `null` for a verse outside the URL's chapter (T-012), so a real one would take
the canonical form.

`Cmd+Enter` shares a branch with `Ctrl+Enter` and was not pressed, and a real held key
was not tried, only events with `repeat: true`.
