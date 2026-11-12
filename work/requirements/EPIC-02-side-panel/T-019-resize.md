# T-019 — Drag-to-resize with persisted width

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Done |
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

- [x] Dragging resizes smoothly, with no pointer loss when crossing into the
      iframe
- [x] The width clamps at 280px and at 50% of the viewport
- [x] The width survives a reload, and a chapter navigation
- [x] Saved at 30% on a 1920px screen, it is still 30% on a 1280px screen
- [x] Double-click resets to 30%
- [x] Tab reaches the handle; arrows adjust; Home resets
- [x] **Pinned**, dragging across the full range does not cause visible jank on a
      long chapter such as Psalm 119
- [x] With `DEBUG_SCHEDULE = true`, one drag produces a small number of
      `schedule()` calls, not one per pointer event

## Test it by hand

1. **Load the change.** `chrome://extensions` → BibleBoost → the reload arrow, then
   reload every bible.com tab that was open.
2. **Starting state.** A maximised window on the long chapter
   `https://www.bible.com/bible/339/PSA.119.TAOVBSI?parallel=114`, either theme.
   Click the slim **B** tab on the right edge to open the panel. If its pin (top
   right of the panel) is pressed, click it so the panel floats over the page.
3. Point at the panel's left edge: the cursor becomes a left-right arrow and a grey
   band shows along the edge. Press and drag left, then back right across the
   panel's own area and out again. The edge follows the pointer the whole way,
   including while the pointer is over the panel, and nothing in the panel is
   clicked or selected.
   → Acceptance: Dragging resizes smoothly, with no pointer loss when crossing into the iframe
4. Drag as far left as it will go: it stops at half the window. Drag as far right
   as it will go: it stops at about 280px, with the header's **BibleBoost**, pin and
   **×** still on one line.
   → Acceptance: The width clamps at 280px and at 50% of the viewport
5. Drag to any width in between and let go. Press **F5**: the panel comes back at
   that width. Click the **Next Chapter** arrow at the bottom of the reader: still
   that width. → Acceptance: The width survives a reload, and a chapter navigation
6. Double-click the edge. The panel glides back to 30% of the window.
   → Acceptance: Double-click resets to 30%
7. Open DevTools, **Ctrl+Shift+M**, and choose **Responsive** at 1920 × 1080. In
   the Console (context **top**) run
   `Math.round(document.getElementById('bb-panel').getBoundingClientRect().width / document.documentElement.clientWidth * 100)`:
   it says **30**. Change the size to 1280 × 800 and run it again: still **30**.
   Close the device toolbar.
   → Acceptance: Saved at 30% on a 1920px screen, it is still 30% on a 1280px screen
8. Click the panel's **×**, then click the **B** tab to open it again, which leaves
   focus on the tab. Press **Tab** (once, or a few times if the dock's switches come
   first) until a blue band shows on the panel's edge. Press **←** three times: the
   panel widens step by step. Press **→**: it narrows. Press **Home**: it glides
   back to 30%.
   → Acceptance: Tab reaches the handle; arrows adjust; Home resets
9. Click the **pin** in the panel's header so the page narrows beside it. Scroll to
   the middle of the psalm. Drag the edge slowly across its whole range and back,
   then let go. The edge keeps up with the pointer, and the page's text holds still
   during the drag and re-wraps once when you let go, with the verse you were
   reading still in place.
   → Acceptance: **Pinned**, dragging across the full range does not cause visible jank on a long chapter such as Psalm 119
10. In the repository, `content.js` line 516: change `const DEBUG_SCHEDULE = false;`
    to `true`, save, and redo step 1. On Psalm 119, pinned, open the Console
    (context **top**) and clear it. Drag the edge once and let go: count the
    `[BibleBoost] schedule:` lines. Expect one to three, not dozens. Then focus the
    edge (step 8) and tap **←** five times quickly: again one to three. Set
    `DEBUG_SCHEDULE` back to `false` and redo step 1.
    → Acceptance: With `DEBUG_SCHEDULE = true`, one drag produces a small number of `schedule()` calls, not one per pointer event
11. **Standing regression** on `/bible/339/EXO.13.TAOVBSI?parallel=114`: verses
    align, separators draw, `Alt+P` / `Alt+A` / `Alt+S` work, and changing the
    reader's "Aa" size re-aligns.

On a failure, send the step number and what you saw instead, a screenshot, and
anything red in the Console's **top** context.

## Notes

**Checked by hand by the user, 2026-11-11.** They reported that every step of
*Test it by hand* worked, standing regression included, and every box above is
ticked on that report.

**Built 2026-11-11, alongside T-020 and T-021.** No box was ticked at build time:
every one needs a real pointer on the live page, which is the user's Chrome.

- **The handle is its own element, `#bb-panel-grip`**, beside `#bb-panel` and not
  inside it. B-019 gave the box `overflow: hidden` to round the frame, which would
  clip a hit area reaching out over the page. It is 16px wide, 12px over the page
  and 4px over the panel, under the tab and over the panel. That puts 3px of it
  inside the frame, past the panel's 1px border, which the note list's rows leave
  clear with their 4px inset (T-021). Centred on the edge, it reached 7px in, and a
  press on a row's left edge started a resize. The 6px band R1 asks for is drawn only on
  hover, focus and drag, to stay compact at rest. It comes before the box in the
  DOM so Tab reaches it before the panel's own controls.
- **One clamp, in CSS:** `--bb-panel-w` is `clamp(280px, --bb-panel-width, 50%)`,
  and the panel, the tab, the grip and the pinned squeeze all read it. Why it is
  declared on each element and not on `<html>` is in `02-css-and-theming.md`.
- **The preview never touches the page (R6).** During a drag or key presses the
  width is written on the panel, tab and grip only, at most once a frame. Release
  holds the reader's place with `holdPosition()`, writes `<html>`, and finishes
  `body`'s padding transition at once (`settle()`). Arrow keys commit once they
  have been quiet for 300ms, so a held key is one commit, not thirty a second.
- **`--bb-panel-width` is on `<html>` only while the panel is open**, and comes off
  on close and on `pagehide`, as T-018 R4 asks of `--bb-squeeze`.
- **Only the reset animates (R9)**, through `data-bb-easing` on the three elements,
  and not under `prefers-reduced-motion`.

**Checked through a stand-in on 2026-11-11** (a reader-shaped Psalm 119, 176 verses
a column, with the real `content.js`, `panel-host.js` and `content.css`; the recipe
is in `03-task-workflow.md`):

- At 1400 × 900 the panel opened at 415px of 1385px, its edge at 969px as T-018
  measured, and pinned, `body`'s padding matched the panel to the hundredth of a
  pixel at every width tried.
- It clamped at 692px (50%) and 280px. Saved at 30%, it measured 30% of 1905px and
  of 1265px. At 820px wide, 30% would be 241px, and it held 280px.
- 43 synthetic pointer moves made no write and no `schedule()` call, and the release
  made one of each. Five quick arrow presses made one write and one call. A press
  with no movement wrote nothing, and a double-click stored 30.
- Close and `pagehide` left nothing on `<html>`, and a reload restored the width as
  a percentage.

Not shown there: real pointer capture across the frame, and whether the preview
paints smoothly, because the pane was hidden and throttled every
`requestAnimationFrame`. Those are steps 3 and 9.

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
