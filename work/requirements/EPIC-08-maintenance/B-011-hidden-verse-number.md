# B-011 — A verse whose number is switched off reads as a continuation fragment

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Found by T-014 |
| Blocks release | No |
| Depends on | T-001 |
| Size | S |
| Risk | Medium |

## The problem

`BB.dom.verseLabel(el)` looks for `:scope > [class*="_label"]`, and a verse element
with no such child is treated as the tail of a verse that spilled into the next
paragraph (`02-verse-dom.md`).

Turning off **Numbers and Titles** in bible.com's reader Settings renames the verse
number's class from `_label` to a bare `_hide`. Measured on 2026-11-10, logged out, on
NKJV Exodus 13:3: `<span class="cat7xG_hide">3</span>`, `display: none`, and
`verseLabel` returned nothing. So with that switch off, every verse looks like a
continuation fragment.

## What depends on it

From reading the code. The effect on a live page has **not** been measured.

| Caller | With no label |
|---|---|
| `topOf` in `content.js` | Falls back to the verse's first line, which may be fine |
| The section-heading test in `content.js` | `.find(verseLabel)` finds nothing, so no verse is recognised as opening a section |
| `refFromHeading` in `capture.js` | Gives up, so a save of several verses stores no `displayRef` and falls back to the `usfm` |

## Scope

**In:** making `verseLabel` find a verse's number when it is switched off, and
checking what alignment does in that state.

**Out:** note text in saved verses, fixed during T-014.

## Requirements

**R1.** Do not simply add `[class*="_hide"]` to the selector. With **Footnotes** off a
note is a direct child with `_hide` as well, so the test has to exclude anything
holding a `_body`.

**R2.** Check whether "Titles" in that switch changes section headings too, before
relying on the heading test. `04-section-headings.md` is where the answer goes.

**R3.** Alignment, separators and `displayRef` must behave the same with the switch
on or off, or the task must say why they cannot.

## Files

- `src/content/bible-dom.js` — `verseLabel`

## Reference

- `work/understandings/bible-com/02-verse-dom.md` — "The reader's own switches rename
  these classes"
- `work/understandings/bible-com/04-section-headings.md`

## Acceptance

- [ ] With Numbers and Titles off, `verseLabel` finds the number of every verse on
      NKJV Exodus 13
- [ ] With Footnotes off and Numbers and Titles on, it still does not mistake a note
      for a number
- [ ] A parallel chapter aligns and draws separators with the switch off
- [ ] A save of several verses has a `displayRef` with the switch off
