# T-058 — Stay at the same verse after a swap

| Field | Value |
|---|---|
| Epic | EPIC-09 Swap sides |
| Status | Not started |
| Depends on | T-057 |
| Blocks | — |
| Size | M |
| Risk | Medium — timing against bible.com's page load and `align()` |

## Why

A swap is a full page load, so the reader lands at the top of the chapter. At verse
140 of Psalm 119 that loses their place entirely, for what should feel like a small
change to the layout.

## Scope

**In:** remembering the verse at the top of the screen across a swap, and returning
to it.

**Out:**

- Restoring position after Parallel on or off, after a chapter change, or after a
  reload. Only a swap does this.
- Client-side navigation through `window.next.router`. It needs a main-world script,
  which this extension does not have.

## Requirements

**R1. Measure first.** No understanding file records which element scrolls on
bible.com's reader. Establish whether it is `document.scrollingElement` or an inner
container, in parallel mode, and record the answer in
`work/understandings/bible-com/02-verse-dom.md` before writing the restore.

**R2.** Just before `swapSides()` navigates, write one entry to `sessionStorage`
under the key `bb-swap-position`:

| Field | Meaning |
|---|---|
| `ref` | The chapter, from `parseUrl().ref` |
| `vid` | The primary column's version id, before the swap |
| `usfm` | The first verse in that column whose top edge is within the viewport |
| `offset` | That verse's distance from the top of the viewport, in px |
| `at` | `Date.now()` |

Find the verse by walking `firstSpans(col)`, which is in document order, and stop at
the first hit, so this is not a full measuring pass.

**R3.** Use `sessionStorage` and not `chrome.storage.sync`. The entry belongs to one
tab and one navigation, and it must not spend `storage.sync`'s write quota. Wrap each
access in `try`/`catch`, since a page with storage blocked throws, and a failure here
must never stop the swap.

**R4.** Restore from the existing path: at the end of `refresh()`, after `align()` has
set the gaps. **Do not add a polling loop** (`01-urls-and-routing.md`). `schedule()`
already fires as the columns arrive, and each pass tries again until the verse exists.

**R5.** Measure against the column with the stashed `vid`, wherever it now is. A swap
changes the sides and not the versions, so the verse read from that version before
the swap is still on the page in that version. Looking in the new left column
instead would miss verses that one version combines and the other does not, as CEV
does with `ROM.1.3+ROM.1.4`.

**R6.** Scroll so that the verse's top is `offset` px from the top of the viewport.
Storing the offset instead of aligning to the top means bible.com's sticky chrome
needs no measuring of its own.

**R7.** The entry is one-shot. Remove it on the first successful restore, or as soon
as it is found to be unusable:

- `ref` differs from the current chapter
- `at` is more than 15 seconds old, which is a judgement of how long a slow load
  takes and not a measurement
- it does not parse

If the column or the verse never appears, nothing happens, no error is shown, and the
15 seconds retire the entry on a later pass.

**R8.** The restore is instant, not a smooth scroll. The reader should not watch the
chapter go past.

## Files

- `content.js` — stash in `swapSides`, restore from `refresh`
- `work/understandings/bible-com/02-verse-dom.md` — the scrolling element (R1)
- `work/understandings/bible-com/01-urls-and-routing.md` — anything learned about
  page-load timing

## Reference

- `work/understandings/bible-com/01-urls-and-routing.md` — hook `schedule()`, no new loop
- `work/understandings/bible-com/02-verse-dom.md`
- `work/understandings/bible-com/03-columns-and-versions.md` — Column order, CEV
- `work/understandings/extension/04-observer-hazards.md` — the cost of an `align()` pass

## Acceptance

- [ ] R1's answer is written in `02-verse-dom.md`
- [ ] On `/bible/339/PSA.119.TAOVBSI?parallel=114`, scrolled to about verse 140, a
      swap leaves that same verse at the same height, within one line
- [ ] Swapping back does the same
- [ ] The result is the same with alignment off
- [ ] Swapping at the very top of a chapter stays at the top
- [ ] Reloading the swapped page does not jump back to the stashed verse
- [ ] Parallel off and on does not restore anything
- [ ] Moving to the next chapter immediately after a swap does not jump
- [ ] In the DevTools Application tab, `bb-swap-position` is gone after the restore
- [ ] The standing regression check passes on a swapped page: verses align, separators
      draw, `Alt+P` / `Alt+A` / `Alt+S` work, and "Aa" re-aligns

## Notes

`align()` can run again after a late font swap (`document.fonts` `loadingdone`), and
that could move the verse a little after the restore. No settling window is specified
because nobody has seen this happen. If the check above shows it, record what was
seen and extend this task then.
