# T-015 — Independent save chip and Alt+N

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Not started |
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
- `README.md` — document `Alt+N` alongside the other shortcuts

## Reference

- `work/understandings/bible-com/06-verse-action-menu.md` — the resilience
  strategy this task implements
- `work/understandings/extension/04-observer-hazards.md` — the chip appears and
  disappears constantly, so `data-bb-own` matters most here
- `work/understandings/bible-com/05-theme-and-page-chrome.md` — the bottom-chrome
  variables

## Acceptance

- [ ] Selecting a verse shows the chip; deselecting hides it
- [ ] Clicking it opens the same popover as the menu row, with the same draft
- [ ] `Alt+N` saves the selection with no mouse
- [ ] `Alt+N` while typing in a text field does **not** fire
- [ ] `Alt+N` with nothing selected shows a hint
- [ ] **With `menu.js` removed from the manifest, the whole save flow still
      works**
- [ ] With `DEBUG_SCHEDULE = true`, the chip appearing and disappearing a dozen
      times does not spam `schedule()`
- [ ] The chip never covers the selected verse
- [ ] `Alt+P`, `Alt+A`, `Alt+S` are unaffected

## Notes

The sixth acceptance item is the point of the task. Actually run it — a fallback
that has never been tested without the primary is not a fallback.

`BB.savePopover.open(chipEl)` opens the popover, and it takes no argument for `Alt+N`,
with nothing to anchor to or give focus back to (T-014). It reads the verses once, as
it opens, so a text selection collapsing afterwards cannot change what is saved. Not
measured: whether moving focus into the popover does collapse one. If it does, Cancel
cannot bring it back unless this task keeps the `Range`.
