# T-058 — Stay at the same verse after a swap

| Field | Value |
|---|---|
| Epic | EPIC-09 Swap sides |
| Status | Done |
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
the first hit, so this is not a full measuring pass. Write nothing when `window.scrollY`
is 0: the next page starts at the top anyway, and a heading of a different height
could otherwise nudge it off.

**R3.** Use `sessionStorage` and not `chrome.storage.sync`. The entry belongs to one
tab and one navigation, and it must not spend `storage.sync`'s write quota. Wrap each
access in `try`/`catch`, since a page with storage blocked throws, and a failure here
must never stop the swap.

**R4.** Restore from the existing path: at the end of `refresh()`, after `align()` has
set the gaps. **Do not add a polling loop** (`01-urls-and-routing.md`). `schedule()`
already fires as the columns arrive, and each pass tries again until the verse exists.
Wait for `ready` as well, because until the stored settings arrive `align()` runs on the
defaults and a reader with alignment off is about to lose those gaps, and for `columns()`,
because the second column arriving would move the verse.

**R5.** Measure against the column with the stashed `vid`, wherever it now is. A swap
changes the sides and not the versions, so the verse read from that version before
the swap is still on the page in that version. Looking in the new left column
instead would miss verses that one version combines and the other does not, as CEV
does with `ROM.1.3+ROM.1.4`.

**R6.** Scroll so that the verse's top is `offset` px from the top of the viewport.
Storing the offset instead of aligning to the top means bible.com's sticky chrome
needs no measuring of its own.

**R7.** The stored entry is one-shot. Remove it on the first successful restore, and
only then, or as soon as it is found to be unusable. A later pass that removed it too
could land between a click on the swap button and the page unloading, and delete the
position that click has just written. It is unusable when:

- `ref` differs from the current chapter
- `at` is more than 15 seconds old, which is a judgement of how long a slow load
  takes and not a measurement
- it does not parse

If the column or the verse never appears, nothing happens, no error is shown, and the
15 seconds retire the entry on a later pass.

**R8.** The restore is instant, not a smooth scroll. The reader should not watch the
chapter go past.

**R9. Hold the position after the restore.** Keep it in memory and correct any drift of
a pixel or more on every later `refresh()`, for 15 seconds from the swap. The first
restore is too early to be the last, because bible.com applies the reader's settings
after hydration (`02-verse-dom.md`).

**R10. Let go when the reader moves the page.** A `wheel`, `touchstart`, `keydown` or
`mousedown` outside BibleBoost's own UI ends the hold, so that a later pass never drags
them back. The dock is excepted, because pressing the swap button is not moving the page.

**R11. Reuse a held position.** A swap made while a position is held writes that same
position with a new `at`, and measures nothing. A measurement carries whatever error the
page has at that moment into the next page, where the next swap adds to it.

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

- [x] R1's answer is written in `02-verse-dom.md`
- [x] On `/bible/339/PSA.119.TAOVBSI?parallel=114`, scrolled to about verse 140, a
      swap leaves that same verse at the same height, within one line
- [x] Swapping back does the same
- [x] With Footnotes off in bible.com's Settings, swapping 8 times in a row at verse 6 of
      Exodus 13 leaves it at the same height, clicking slowly and as fast as the page allows
- [x] Scrolling with the wheel or the scrollbar straight after a swap is not pulled back
- [x] The result is the same with alignment off
- [x] Swapping at the very top of a chapter stays at the top
- [x] Reloading the swapped page does not jump back to the stashed verse
- [x] Parallel off and on does not restore anything
- [x] Moving to the next chapter immediately after a swap does not jump
- [x] In the DevTools Application tab, `bb-swap-position` is gone after the restore
- [x] The standing regression check passes on a swapped page: verses align, separators
      draw, `Alt+P` / `Alt+A` / `Alt+S` work, and "Aa" re-aligns

## Notes

The first version restored once and stopped. On a real page the user opened a chapter,
scrolled to verse 6, swapped repeatedly and ended up at verse 8. R9 to R11 are the fix.

## Where it stands (2026-11-10)

**Confirmed in a real Chrome by the user**, who reported on 2026-11-10 that repeated
swaps at verse 6 no longer creep, which was the bug described below, and that every
other check on this list passes on live bible.com. R1 was measured on the live page.

**The creep was reproduced and traced**, by serving bible.com's real pages through a
local proxy with the real page files added (`03-task-workflow.md`). With Footnotes off,
verse 6 of Exodus 13 climbed 19px on every swap: 250, 231, 211, 192, 173, 153. Each
restore landed exactly, then bible.com applied the setting about 400 ms later and the
text above came out shorter. With the fix, 9 swaps ended at the same height at 250 ms,
500 ms and 1500 ms apart. Without Footnotes off there was no creep to begin with, on
Exodus 13 or Psalm 119, with separators on or off.

Also on that proxy, while a position was held, a wheel scroll and a click on the page
scrollbar both ended the hold with no pull back, and a swap from the new place kept
the new place.

On an earlier local page shaped like the reader, before R9 to R11:

- Swapping forward and back near verse 139 of a 176-verse chapter, and swapping with
  alignment off, put the verse back at the same height to the pixel
- A swap at the very top wrote no entry and stayed at the top
- A reload, Parallel off and on, another chapter, an expired entry and a corrupt entry
  all left the page where it loaded and left no entry behind
- Columns arriving 700 ms after the script ran kept the entry waiting, then restored
- A verse missing from the new left column was still found through its own version
- With `sessionStorage` throwing, the swap still happened, with no console errors
