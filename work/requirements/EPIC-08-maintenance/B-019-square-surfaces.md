# B-019 — BibleBoost's surfaces are square beside bible.com's rounded ones

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | In progress |
| Type | Inconsistency, reported by the user |
| Blocks release | No |
| Depends on | — |
| Size | S |
| Risk | Low |

## The problem

Reported by the user on 2026-11-10: "All the UI are boxed, but the bible.com panel,
popups are having rounded edges." Each surface had picked its own literal, and nothing
said which one a new surface should take:

| Surface | Radius before |
|---|---|
| `#bb-panel` (side panel) | none, a plain rectangle |
| `#bb-save-pop`, `#bb-toast`, `#bb-hint` | `8px` |
| `#bb-save-pop .bb-list` (combobox list) | `--bb-radius`, 4px |
| Fields, buttons, list options | `--bb-radius`, 4px |
| Dock, switches, chip, panel tab, tag chips | `999px`, written out each time |
| `popup.html` | `4px`, `999px` and `3px`, written out |

bible.com's own floating surfaces measure 16px and 24px, its controls 4px, and its
buttons and fields are full pills. The full table is in
`work/understandings/bible-com/05-theme-and-page-chrome.md`.

## Why it matters

The extension's surfaces sit on bible.com's page and open from bible.com's own menu, so
a square card beside a rounded one reads as bolted on. With no rule written down, the
next surface would have picked a fourth value.

## Scope

**In:** radius tokens in both theme files and in the popup's own set, applying them to
every surface, and writing the rule where future sessions will read it
(`conventions/02-css-and-theming.md`, `AGENTS.md`).

**Out:** colours, shadows (the panel gets no new shadow), any size, position or padding,
the colour-token fallbacks that are B-008's, and the popup's layout. Phone widths, under
768px: phones are not a target (AGENTS.md, Target screens), so the panel's corners there
were left as the base rule draws them.

## Requirements

**R1.** `--bb-radius-lg: 16px` and `--bb-radius-pill: 999px` are declared in `:root`
of both `src/shared/theme.css` and `content.css`, beside `--bb-radius`.

**R2.** Floating surfaces (`#bb-save-pop`, `#bb-toast`, `#bb-hint`, `#bb-panel`) take
`--bb-radius-lg`. 16px everywhere, no breakpoint: the user's choice over bible.com's own
16px-then-24px.

**R3.** A surface fixed to the window's edge rounds only the side that faces the page.
`#bb-panel` rounds its top-left and bottom-left and stays square against the right edge,
as bible.com's verse menu stays square against the bottom.

**R4.** A surface nested inside another takes the control radius plus its own padding:
the combobox list is 8px.

**R5.** No `border-radius` in `content.css` or `src/ui/panel.html` is a literal outside
a token declaration. Every pill reads `--bb-radius-pill`.

**R6.** `popup.html` gets `--radius` and `--radius-pill` in its own set and uses them.
`.brand img` keeps its 5px, which shapes the app icon rather than a surface.

**R7.** The rule is recorded in `conventions/02-css-and-theming.md` and as a hard rule in
`AGENTS.md`, and bible.com's measured radii in `bible-com/05-theme-and-page-chrome.md`.

## Files

- `src/shared/theme.css`, `content.css` — tokens and their banner comments
- `content.css` — every `border-radius`
- `popup.html` — its token set and its radii
- `AGENTS.md`, `work/understandings/conventions/02-css-and-theming.md`,
  `work/understandings/bible-com/05-theme-and-page-chrome.md`

## Reference

- `work/understandings/conventions/02-css-and-theming.md`
- `work/understandings/bible-com/05-theme-and-page-chrome.md` — Corner radii
- `work/understandings/bible-com/06-verse-action-menu.md` — the card the popover opens from

## Acceptance

- [x] `grep -nE "border-radius:\s*[0-9]" content.css src/ui/panel.html` finds nothing
- [x] The radius tokens in the `:root` of `theme.css` and `content.css` are identical
- [x] On a live page, the popover, toast and hint compute a 16px radius and the list 8px
- [x] The open panel is rounded on its left side, square on its right, and the frame's
      content is clipped to the curve
- [ ] At a tablet width (820px) and on a large screen, the panel, popover and toast keep
      the same corners
- [ ] The dock, chip and panel tab look exactly as before
- [ ] The standing regression check passes

## Test it by hand

About ten minutes, in your own Chrome with the unpacked extension.

**Load the change**

1. Open `chrome://extensions`, find **BibleBoost**, and click its reload arrow. Then
   reload every bible.com tab that was already open, because a content script does not
   update in a tab loaded before the reload.
2. Open `https://www.bible.com/bible/339/EXO.13.TAOVBSI?parallel=114` in a window wider
   than 768px. Open the account menu (the round button at the top right) and choose
   **Appearance → Dark**.

**The pills: nothing should have changed**

3. Look at the bottom-right corner. **Expect:** the dock, with **P** and **A** beside
   their switches and a swap icon, is a fully rounded pill. Hover it: the letters spell out
   into words, and it stays a pill.
   → Acceptance: the dock, chip and panel tab look exactly as before
4. Look at the right edge of the window, halfway down. **Expect:** the slim **B** tab is
   rounded at its left end and flat against the window's edge.
   → Acceptance: the dock, chip and panel tab look exactly as before
5. Tap verse 2 in the left (Tamil) column. **Expect:** bible.com's verse menu rises at the
   bottom. Beside the verse, a small pill with a bookmark-and-plus icon appears. Hover the
   pill: the word **Save** slides out, and it stays a pill.
   → Acceptance: the dock, chip and panel tab look exactly as before

**The popover, its list and the toast**

6. In bible.com's verse menu, click **Save to BibleBoost**, the row between Highlight and
   Copy. **Expect:** the save popover opens with all four corners clearly rounded, close to
   the roundness of bible.com's menu card beneath it. The fields and buttons inside have
   only slightly rounded corners.
   → Acceptance: the popover, toast and hint compute 16px, the list 8px
7. Click in the **Find or create a topic** field. **Expect:** a list drops down under it.
   Its corners are rounder than the field's and less round than the popover's, and the
   highlighted row's corners follow the list's curve.
   → Acceptance: the popover, toast and hint compute 16px, the list 8px
8. Press `Escape` to close the list, leave the topic as it is, and click **Save**.
   **Expect:** the popover closes. Where it was, a message reading **Saved to …** appears
   with an **Undo** button, rounded like the popover.
   → Acceptance: the popover, toast and hint compute 16px, the list 8px
9. Click **Undo** within five seconds, so the test leaves no note behind. **Expect:** the
   message changes to **Moved to Trash**. This step ticks no box.
10. Click verse 2 again so that nothing is selected. Click once in the right (English)
    column, which gives the page focus without selecting anything, because only the left
    column responds to taps. Then press **left** `Alt` + `N`. **Expect:** "Select a verse first, then press Alt+N" appears above
    the dock for about two seconds, rounded like the toast.
    → Acceptance: the popover, toast and hint compute 16px, the list 8px
    If nothing appears, that is probably B-006: Alt shortcuts were not reaching the page
    in your Chrome. Note it and carry on.

**The side panel**

11. Click the **B** tab. **Expect:** the panel opens on the right, rounded at its top-left
    and bottom-left and flat against the right edge. Look closely at the bottom-left corner,
    where the page shows beneath the panel: nothing inside the panel pokes past the curve.
    → Acceptance: the open panel is rounded on its left side, square on its right…
12. In the account menu, choose **Appearance → Light**, then repeat steps 3, 6, 8 and 11 by
    eye. **Expect:** the same shapes, and a thin grey border that follows every curve with
    no gap at the corners. This step only confirms; no box hangs on it.

**Tablet and large screen**

13. Press `F12`, then `Ctrl+Shift+M` for the device toolbar. Choose **Responsive**, type
    `820` × `1180` (an iPad Air held upright), and reload. Click the **B** tab, then repeat
    steps 5, 6 and 8. **Expect:** the panel opens beside the page, not over all of it. It is
    rounded on the left and flat on the right, and the popover and toast are as round as
    they were at full width.
    → Acceptance: at a tablet width (820px) and on a large screen, the corners stay the same
14. Close the device toolbar. On the largest monitor you have, maximise the window and
    reload. If you have no large monitor, use **Responsive** at `1920` × `1080` instead.
    Open the panel and the popover again. **Expect:** the panel is wider, because it takes
    30% of the window, but its curve is the same size as before, not a bigger one.
    → Acceptance: at a tablet width (820px) and on a large screen, the corners stay the same

**Standing regression**

15. On `/bible/339/EXO.13.TAOVBSI?parallel=114` at full width, check each of these:
    - Verse numbers line up across the two columns.
    - With separators on, a faint line runs between the verse rows. Turn them on with the
      popup's **Verse separators** switch if they are off.
    - **Left** `Alt` + `P`, `Alt` + `A` and `Alt` + `S` toggle parallel, alignment and
      separators. Click in the right column first.
    - After changing the text size with the reader's **Aa** button at the top, the columns
      line up again.

    If the `Alt` keys do nothing while the dock's switches work, that is B-006, not this
    change.
    → Acceptance: the standing regression check passes

**If a step fails**, send its number, what you saw instead, and a screenshot of the corner
in question.

## Notes

**Verified 2026-11-10, without the extension loaded.** On live
`/bible/339/EXO.13.TAOVBSI?parallel=114` at 1280x900 and 1024x768, dark, the working copy's
`content.css` was pasted into a `CSSStyleSheet` (see `03-task-workflow.md`). Stand-ins
carrying the real ids were then added: `#bb-save-pop` with its list open, `#bb-toast`,
`#bb-hint`, `#bb-panel` with a `srcdoc` frame, `#bb-panel-tab`, `#bb-dock` and `#bb-chip`.

- Computed radii: popover, toast and hint `16px`, list `8px`, its options, the fields and
  buttons `4px`. The panel is `16px 0px 0px 16px` with borders on top, bottom and left.
  The tab, dock, switch and chip read `999px`, the same value as before. The radii are the
  same with `html.light`.
- The clip was shown by hit-testing, because the pane was hidden and its screenshots were
  stale. 2px inside each rounded corner `elementFromPoint` returned bible.com's own
  elements, and at the square corners it returned the frame. With `overflow: visible` the
  rounded corners returned the frame, so the check can fail.
- `node --test`: 232 pass.

Not seen with the eye: the panel's corners on screen, and the dock, chip and tab, which
compute exactly what they did before. Those boxes, the tablet and large-screen check and the
standing regression all wait for the unpacked extension in Chrome.

**Phone widths dropped, 2026-11-10.** The task first asked for a phone-width corner rule.
The user then set the target as tablets, PCs and large screens, so that requirement was
removed and the 375px box replaced with the tablet and large-screen one.
