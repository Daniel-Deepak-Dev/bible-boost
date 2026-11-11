# T-019 — Drag-to-resize with persisted width

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Not started |
| Depends on | T-017 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

30% is the stated default, but the right width depends on the screen and on what
the user is doing — reading a long note wants more, glancing at a list wants
less. Making it draggable is cheap and removes a whole class of "it is the wrong
size" friction.

## Scope

**In:** the drag handle, clamping, persistence.

**Out:** the squeeze behaviour itself (T-018) — this task changes the width;
T-018 decides what the width does to the page.

## Requirements

**R1.** A drag handle on the panel's left edge, at least 6px wide with a larger
invisible hit area, showing a `col-resize` cursor.

**R2.** Default width 30% of the viewport. Clamp between **280px** and **50%** of
the viewport. Below 280px the compact list stops being readable; above 50% the
reader does.

**R3.** Persist the width in `chrome.storage.local` as a **percentage**, not
pixels, so it behaves sensibly when the user moves between a laptop and an
external monitor. Restore on load.

**R4.** The drag is owned by the **host**, not the iframe — the pointer leaves
the iframe during the drag. The iframe must not swallow the pointer events.
Use pointer capture on the handle.

**R5.** While dragging, set `pointer-events: none` on the iframe so it does not
capture the pointer mid-drag. Restore it on release.

**R6.** **Throttle the squeeze with `requestAnimationFrame`.** When pinned, every
width change reflows bible.com and may re-run `align()`. Writing a width on every
`pointermove` would run alignment dozens of times a second on a long chapter.
Apply the final width on release, and a cheap preview during the drag.

**R7.** Double-clicking the handle resets to the 30% default.

**R8.** Keyboard accessible: the handle is focusable, with Left/Right arrows
adjusting by 2% and Home resetting. A pointer-only control is an accessibility
gap.

**R9.** Respect `prefers-reduced-motion` — no transition on the drag itself, only
on the reset.

## Files

- `src/content/panel-host.js`
- `content.css`

## Reference

- `work/understandings/extension/04-observer-hazards.md` — why R6 matters
- `work/understandings/extension/02-storage-model.md` — `storage.local` holds
  panel UI state
- `work/understandings/conventions/02-css-and-theming.md`

## Acceptance

- [ ] Dragging resizes smoothly, with no pointer loss when crossing into the
      iframe
- [ ] The width clamps at 280px and at 50% of the viewport
- [ ] The width survives a reload, and a chapter navigation
- [ ] Saved at 30% on a 1920px screen, it is still 30% on a 1280px screen
- [ ] Double-click resets to 30%
- [ ] Tab reaches the handle; arrows adjust; Home resets
- [ ] **Pinned**, dragging across the full range does not cause visible jank on a
      long chapter such as Psalm 119
- [ ] With `DEBUG_SCHEDULE = true`, one drag produces a small number of
      `schedule()` calls, not one per pointer event

## Notes

The seventh and eighth acceptance items are the real test. Test on a long
chapter, pinned — that is where an unthrottled implementation falls over, and a
short chapter will hide the problem completely.

**What T-018 left for this task (2026-11-10).**

- The squeeze rule in `content.css` reads `--bb-panel-width`, with the same 30%
  fallback the panel and the tab use, so setting that one variable moves all three.
  Set it on `documentElement`: it is the only common ancestor of the tab, the panel
  and `body`.
- That rule gives `body` a `transition: padding-right 0.2s`. While a pinned panel is
  being dragged, switch the transition off, or every width written animates a reflow
  of the whole page (R6, R9).
- A width change while pinned re-wraps the page just as pinning does, so the verse
  being read moves. `holdPosition()` in `panel-host.js` is what T-018 uses to keep it
  in place. Call it before the width written on release.
