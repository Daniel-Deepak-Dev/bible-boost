# T-057 — The ⇄ button on the dock

| Field | Value |
|---|---|
| Epic | EPIC-09 Swap sides |
| Status | Not started |
| Depends on | T-004, T-056 |
| Blocks | T-058 |
| Size | S |
| Risk | Low — one button on an existing dock, no new storage |

## Why

The reader wants to trade the two versions without opening bible.com's version
pickers twice. The dock is already on screen and already holds the parallel
controls, so it is where this belongs.

## Scope

**In:** the button, its icon and styling, and the swap itself.

**Out:**

- **A keyboard shortcut.** Chrome allows four suggested keys, `Alt+P/A/S` use three
  and T-029 claims the last.
- **A control in the popup.** The popup's two version pickers can already do this.
- **Forcing an order on arrival.** A link naming the other order opens as written
  (see `EPIC.md`).
- **Keeping the reading position** (T-058).

## Requirements

**R1.** Add `swapSides()` to `content.js`, beside `setParallel`, under the same
banner. It calls `location.assign()` with the result of `BB.dom.swappedUrl()`, and
does nothing if that is `null`.

**R2.** The abbreviation passed to `swappedUrl` comes from
`BB.capture?.resolveVersion(col)`, for the element in `columnEls()` whose `VID_RE`
match is `loc.parallel`.

- Ignore it when `source` is `'id'`, since that `abbr` is only the number again.
- Pass none when no column carries that vid. Version 48 is a known case where the
  column may not exist (`03-columns-and-versions.md`), and the swap must still work.
- Read `BB.capture` through `?.`. `content.js` runs before `capture.js`, and a capture
  that failed to load must cost the abbreviation and not the swap.

**R3.** The button is a plain `<button>` with `class="bb-swap"` and `data-sw="swap"`,
handled by the dock's existing delegated click listener. It is **not**
`role="switch"` and has no `aria-checked`: a switch announces on or off, and neither
reading order is "on".

**R4.** It has `aria-label="Swap sides"` and the tooltip
`title="Swap the left and right versions"`. It shows the icon alone, at rest and on
hover, with no `bb-short` / `bb-full` label.

**R5.** It comes after the A switch, and exists only when `BB.dom.swappedUrl()` is
not `null`. The condition is read from there and not restated.

**R6.** The icon is ⇄, two opposing arrows, chosen by the user on 2026-11-10 because
it is the mark translation apps use for swapping two languages. It is an inline SVG
and not the Unicode character, whose weight and size would follow whichever fallback
font each machine picks.

| Attribute | Value |
|---|---|
| `viewBox` | `0 0 16 16` |
| Rendered size | 16 x 16 px |
| Path 1, arrow to the right | `M2 5.5h11M10 2.5l3 3-3 3` |
| Path 2, arrow to the left | `M14 10.5H3M6 7.5l-3 3 3 3` |
| Paint | `fill: none`, `stroke: currentColor`, width 1.5, round caps and joins |
| `aria-hidden` | `true` |

`currentColor` makes it follow the dock's theme with no new token.

**R7.** Build the SVG with `document.createElementNS` and the SVG namespace. **Never
`innerHTML`** (AGENTS.md rule 2). `createElement('svg')` produces an element that
does not render.

**R8.** Add the swap condition to `dock.dataset.state` in `renderDock()`. The comment
there says it plainly: every value rendered must appear in the key, or the cache
serves a stale dock.

**R9.** The button needs no marker of its own, because it inherits `data-bb-own` from
the dock root through `closest()`.

**R10.** Add `#bb-dock .bb-swap` to `content.css`, matching `.bb-sw`'s hover and
`:focus-visible` treatment, with a `var()` fallback on every token (rule 1 of
`02-css-and-theming.md`). Correct the dock's banner comment, which says the dock
shrinks to two shortcut letters. Any transition added must also go in the
`prefers-reduced-motion` block.

**R11. Add no storage key.** `remember()` already writes the pair once the swapped
page loads. This requirement exists so that nobody adds a second copy.

## Files

- `content.js` — `swapSides`, the button, the dock's state key, the click listener
- `content.css` — `#bb-dock .bb-swap`, the banner comment
- `work/understandings/extension/04-observer-hazards.md` — only if the check turns up
  something new
- `work/understandings/bible-com/03-columns-and-versions.md` — anything learned about
  a swapped page

## Reference

- `work/requirements/EPIC-09-version-swap/EPIC.md` — how a swap works, and why memory
  is free
- `work/understandings/bible-com/03-columns-and-versions.md`
- `work/understandings/bible-com/01-urls-and-routing.md`
- `work/understandings/extension/04-observer-hazards.md`
- `work/understandings/conventions/02-css-and-theming.md`

## Acceptance

On `/bible/339/EXO.13.TAOVBSI?parallel=114`, with the unpacked extension reloaded:

- [ ] ⇄ appears after the A switch, and has no label at rest or on hover
- [ ] The icon is clearly visible on both `html.light` and `html.dark`
- [ ] One click gives NKJV on the left and TAOVBSI on the right, and a second click
      restores the original
- [ ] A double-click ends in one swap, not a swap and a swap back
- [ ] The address bar reads `/bible/114/EXO.13.NKJV?parallel=339`
- [ ] Tab reaches the button, Enter and Space activate it, and the focus ring shows
- [ ] A screen reader or the accessibility tree reports a button named "Swap sides"

**Where the button must not appear:**

- [ ] A single-version page shows no ⇄
- [ ] A book intro, such as `/bible/339/JHN.INTRO1.TAOVBSI?parallel=114`, shows no ⇄
- [ ] A URL whose `?parallel=` repeats its own id shows no ⇄

**Memory, after swapping to NKJV | TAOVBSI:**

- [ ] Next Chapter keeps NKJV on the left
- [ ] Parallel off and on with the dock returns NKJV | TAOVBSI
- [ ] The popup shows NKJV on the left and TAOVBSI on the right, and Open goes there
- [ ] The order survives closing and reopening Chrome
- [ ] Opening `/bible/339/EXO.13.TAOVBSI?parallel=114` directly shows TAOVBSI on the
      left and does not redirect, and the popup then shows that order

**No regression:**

- [ ] On the swapped page verses align, separators draw, `Alt+P` / `Alt+A` / `Alt+S`
      work, and changing the reader's "Aa" size re-aligns
- [ ] With `DEBUG_SCHEDULE = true`, hovering and focusing the button logs nothing
- [ ] A verse tapped on the swapped page saves NKJV as `primary`

## Notes

A double-click is safe by construction. `location.href` does not change until the
navigation commits, so both clicks compute the same target.

The button follows the URL, as the A switch does, and not the visible columns. On a
narrow viewport bible.com may hide the second column or drop `?parallel=` altogether
(`03-columns-and-versions.md`, Visibility). If the parameter is gone the button goes
with it. Do not write code against a width.
