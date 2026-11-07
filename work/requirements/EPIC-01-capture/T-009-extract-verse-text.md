# T-009 — Clean verse-text extraction

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Not started |
| Depends on | T-001 |
| Blocks | T-010, T-016 |
| Size | S |
| Risk | Medium — easy to get subtly wrong and not notice |

## Why

A saved note's value *is* the verse text. The text must be clean: no verse
number, no footnote marker letters, no leftover whitespace — and it must be
complete, including the tail of a verse that spilled into the next paragraph.

The DOM makes this non-obvious. A verse's own number and a footnote marker are
**both** `[class*="_label"]` elements; they are distinguished only by depth.

## Scope

**In:** one function that turns a verse's elements into a clean string.

**Out:** finding the elements (T-001's `firstSpans`), the other column (T-010).

## Requirements

**R1.** `BB.capture.verseText(usfm, col) -> string` in `src/content/capture.js`.

**R2.** Collect **every** element in the column whose `data-usfm` first key
matches — not just the first. A verse split across paragraphs has several, and
`firstSpans()` deliberately keeps only the first, so this function cannot reuse
it directly.

**R3.** For each element: `cloneNode(true)`, remove every `[class*="_label"]`
descendant, then read `textContent`. Removing all of them handles both the
direct-child verse number and the deeper footnote markers — **comment why**, in
house style, because the two are different things that happen to share a class
fragment.

**R4.** Join the fragments with a single space. Collapse runs of whitespace,
including non-breaking spaces (` `), and trim.

**R5.** Normalize to NFC. The same Tamil string can arrive composed or
decomposed; storing it unnormalized makes it unsearchable later.

**R6.** Never mutate the live DOM. Clone first, always. This is a founding rule:
bible.com's verse DOM is left alone.

**R7.** Return `''`, not null or undefined, when the verse is not found. Callers
should not have to branch for an empty verse.

## Files

- `src/content/capture.js`

## Reference

- `work/understandings/bible-com/02-verse-dom.md` — the label-vs-footnote
  distinction, verses split across paragraphs, the `+` split
- `work/understandings/bible-com/07-i18n-and-scripts.md` — NFC normalization
- `work/understandings/conventions/01-code-style.md` — hard rule 2, never
  re-render bible.com's DOM

## Acceptance

- [ ] Exodus 13:2 in TAOVBSI extracts the Tamil text with no leading verse number
- [ ] Exodus 13:2 in NKJV extracts the English text with no leading verse number
- [ ] A verse carrying a footnote marker extracts without the marker letter
- [ ] A verse split across two paragraphs extracts **both** fragments, in order,
      separated by one space
- [ ] A poetic verse (Psalms, multiple indented lines) has no doubled or missing
      spaces
- [ ] The result contains no ` ` and no leading or trailing whitespace
- [ ] `extracted === extracted.normalize('NFC')`
- [ ] The live page is visually unchanged after extraction — nothing removed

## Notes

Test against a poetic passage, not just prose. Psalms exercises the
multi-fragment and blank-block cases that prose never hits.
