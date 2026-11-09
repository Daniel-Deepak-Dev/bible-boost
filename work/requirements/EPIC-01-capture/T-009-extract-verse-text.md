# T-009 — Clean verse-text extraction

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Done |
| Depends on | T-001 |
| Blocks | T-010, T-016 |
| Size | S |
| Risk | Medium — easy to get subtly wrong and not notice |

## Why

A saved note's value *is* the verse text. The text must be clean: no verse
number, no footnote marker, no footnote text, no leftover whitespace — and it
must be complete, including the tail of a verse that spilled into the next
paragraph.

The DOM makes this non-obvious. A verse's own number and a footnote marker are
**both** `[class*="_label"]` elements; they are distinguished only by depth. And
the marker is only half of a footnote: the note's text sits beside it in a
`_body` that is `display:none` on screen but still present in `textContent`.

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
and `[class*="_note"]` descendant, then read `textContent`. The first takes the
direct-child verse number, the second takes each footnote or cross-reference
whole, marker and text together — **comment why**, in house style, because the
two are different things that happen to share a class fragment.

> Corrected during T-009. This first said to remove only `_label`, which leaves
> every note's `_body` in the result: NKJV Exodus 13:2 came out starting
> `Ex. 13:12, 13, 15; …`.

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

- [x] Exodus 13:2 in TAOVBSI extracts the Tamil text with no leading verse number
- [x] Exodus 13:2 in NKJV extracts the English text with no leading verse number
- [x] A verse carrying a note extracts with neither the marker nor the note's
      text: NKJV Exodus 13:2 (cross-reference), NIV John 3:3 (footnote)
- [x] A verse split across two paragraphs extracts **both** fragments, in order,
      separated by one space
- [x] A poetic verse (Psalms, multiple indented lines) has no doubled or missing
      spaces
- [x] The result contains no ` ` and no leading or trailing whitespace
- [x] `extracted === extracted.normalize('NFC')`
- [x] The live page is visually unchanged after extraction — nothing removed
- [x] The extension loaded unpacked passes the standing regression check in
      CLAUDE.md

## Notes

Test against a poetic passage, not just prose. Psalms exercises the
multi-fragment and blank-block cases that prose never hits.

### How the ticked items were verified

On live bible.com on 2026-11-09, logged out. The browser used cannot load an
unpacked extension, so `bible-dom.js` and the verse-text section of `capture.js`
were injected into the page with comments stripped, and `verseText.toString()`
was compared against the file.

- `verseText` ran on all 202 verses of Exodus 13, Psalms 3 and 23 and Romans 1 in
  TAOVBSI and NKJV, Romans 1 in CEV, and John 3 in NIV. No result was empty, had
  a leading number or a `#`, had doubled or non-space whitespace, was untrimmed,
  or differed from its NFC form.
- Those chapters were bible.com's server-rendered HTML, fetched and parsed. On
  the hydrated NKJV Exodus 13 page the same function gave identical text for all
  22 verses.
- The sampled text holds no U+00A0 and no decomposed Tamil, so real pages never
  exercised those two steps. Detached fixtures did: `a  b` collapses,
  and U+0BC7 U+0BBE composes to U+0BCB.
- A combined verse behaves as R2 says: CEV `ROM.1.3` returns the text, `ROM.1.4`
  and an unknown usfm return `''`.
- "Nothing removed" on hydrated NKJV Exodus 13: the column's `outerHTML` was
  identical before and after extracting every verse, and a `MutationObserver`
  on it recorded nothing.

The last acceptance item covers what the injection could not: the manifest's load
order, the isolated world, the `BB.capture.verseText` export in the loaded
extension, and alignment still working. It was done by hand with the unpacked
extension in Chrome on 2026-11-09. The console call below, run there, returned the
same Tamil text for Exodus 13:2 as the injected copy did.

To repeat it, pick the BibleBoost context in the DevTools console and run
`BB.capture.verseText('EXO.13.2', BB.dom.columnEls()[0])`.
