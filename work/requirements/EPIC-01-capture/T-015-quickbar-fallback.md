# T-015 — Independent save chip and Alt+N

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Done |
| Depends on | T-004, T-008 |
| Blocks | — |
| Size | S |
| Risk | Low — this task exists to *reduce* risk |

## Why

T-013 injects into bible.com's menu, which is React-rendered with hashed class
names and **will** break on a redesign. This task is the insurance: a save path
that depends on nothing bible.com controls except `data-usfm`.

It is also genuinely faster for a user saving many verses, so it is not merely a
fallback — it earns its place either way.

## Scope

**In:** an extension-owned save affordance and a keyboard shortcut.

**Out:** the popover itself — both paths open the same T-014 popover.

## Requirements

**R1.** `src/content/quickbar.js` shows a small chip near the current selection
whenever `BB.capture.getSelection()` is non-null. Clicking it opens the T-014
save popover with the same draft the menu row would produce.

**R2.** `Alt+N` saves the current selection, with no mouse. Register it in the
**existing** keydown listener in `content.js`, alongside `Alt+P` / `Alt+A` /
`Alt+S` — do not add a second document-level listener.

**R3.** Reuse the existing guard verbatim: ignore the shortcut when the target
`isContentEditable` or is an `INPUT`, `TEXTAREA` or `SELECT`. The user will be
typing in the notes panel, so this is load-bearing.

**R4.** `Alt+N` with nothing selected shows a brief hint rather than silently
doing nothing. A shortcut that appears broken is worse than one that explains
itself.

**R5.** The chip is `data-bb-own`, styled with `--bb-*` in the `#bb-dock` pill
language, collapsed and unobtrusive, and does **not** cover the verse it refers
to.

**R6. It must work with T-013 absent or broken.** Verify by disabling
`menu.js` in the manifest and confirming the full save flow still works.

**R7.** The chip hides when the selection clears, when the user scrolls the verse
out of view, and on chapter navigation.

**R8.** Respect the bottom chrome (`--tabbar-h`, `--audio-bar-h`) if it is ever
positioned near the bottom edge, as `content.css` already does for the dock.

## Files

- `src/content/quickbar.js` — new
- `content.js` — one more case in the existing keydown handler
- `manifest.json` — add to the `js` array
- `content.css` — the chip and the hint. A content script cannot load `theme.css`, so
  R5's styling has to live here (the same reason as T-014)
- `README.md` — document `Alt+N` alongside the other shortcuts
- `test/quickbar.test.js` — new, for the one pure part, where the chip goes

## Reference

- `work/understandings/bible-com/06-verse-action-menu.md` — the resilience
  strategy this task implements
- `work/understandings/extension/04-observer-hazards.md` — the chip appears and
  disappears constantly, so `data-bb-own` matters most here
- `work/understandings/bible-com/05-theme-and-page-chrome.md` — the bottom-chrome
  variables

## Acceptance

- [x] Selecting a verse shows the chip; deselecting hides it
- [x] Clicking it opens the same popover as the menu row, with the same draft
- [x] `Alt+N` saves the selection with no mouse
- [x] `Alt+N` while typing in a text field does **not** fire
- [x] `Alt+N` with nothing selected shows a hint
- [x] **With `menu.js` removed from the manifest, the whole save flow still
      works**
- [x] With `DEBUG_SCHEDULE = true`, the chip appearing and disappearing a dozen
      times does not spam `schedule()`
- [x] The chip never covers the selected verse
- [x] `Alt+P`, `Alt+A`, `Alt+S` are unaffected

## Notes

The sixth acceptance item is the point of the task. Actually run it — a fallback
that has never been tested without the primary is not a fallback.

`BB.savePopover.open(chipEl)` opens the popover, and it takes no argument for `Alt+N`,
with nothing to anchor to or give focus back to (T-014). It reads the verses once, as
it opens, so a text selection collapsing afterwards cannot change what is saved.
`showModal` does collapse one, measured during this task, so `quickbar.js` clones the
`Range` before opening and puts it back on the dialog's `close`.

Three things the requirements left open, decided here. With no place that avoids the
verse the chip hides, so R1's "whenever" has that exception as well as R7's. The draft
stays `source: 'menu'`, since R1 asks for the same draft as the row and `NOTE_SOURCES` has
nothing closer. `Alt+N` is not in the manifest's `commands`, because T-029 needs the last
suggested key.

A `mousedown` guard on the chip was planned and dropped. A real press on a button left a
text selection whole, so it would have guarded nothing.

Checked on 2026-11-10 through a local proxy of the real page
(`conventions/03-task-workflow.md`), with the real content scripts and `content.css`,
`menu.js` left out, the worker stood in, and `requestAnimationFrame` replaced because the
Browser pane was hidden. Clicks, a text drag and key presses were real. At 1024, 760 and
375px, in both themes, the chip was never on a selected verse, for one verse, several, and a
selection taller than the window. Twelve show-and-hide cycles made no `schedule()` calls.
A run with `menu.js` loaded sent byte-identical drafts from the row, the chip and `Alt+N`.
Cancelling after a text drag brought the selection back and focus to the chip. `Aa` and
Align re-placed the chip, and `Alt+P/A/S` worked by real key press.

The proxy could not show three things, so they were checked by hand in real Chrome and
reported working on 2026-11-10. That run used a copy of the extension with `menu.js` gone from
the copy's manifest, which left a shared working folder alone.

- The save through the chip against the real worker, with no row in bible.com's menu. What
  was seen is the "Saved to" confirmation, which only follows the worker's `ok`. The stored
  note was not looked up.
- `Alt+N` opening the popover, and its hint with nothing selected. `Alt+P/A/S` were reported
  dead in that Chrome through this same listener, so this is a clue for B-006, and it is
  written down there.
- R7's chapter navigation. The chip went when the next-chapter arrow was pressed.
