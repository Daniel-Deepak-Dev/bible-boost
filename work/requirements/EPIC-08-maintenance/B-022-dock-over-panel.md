# B-022 — The dock covers the side panel's bottom-right corner

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Done |
| Type | Found by the user's hand test of T-022 |
| Blocks release | No |
| Depends on | T-017 |
| Size | S |
| Risk | Low — one CSS rule, no script |

## The problem

The dock (Parallel, Align verses, swap) is fixed 20px from the window's bottom-right
corner, at `z-index` 2147483000. The side panel is fixed to the window's right edge
from top to bottom, under the dock on purpose (T-017 R7: the dock stays reachable). So
while the panel is open the dock sits over the panel's bottom-right corner.

T-017's Notes saw it ("the dock floats over the panel's bottom-right corner, so T-021
should leave room there"), and nothing left room. What it covers there:

- the **Undo** of the panel's toast (T-022 R5), reported by the user on 2026-11-12
  with a screenshot: "this undo button is hidden, or not clickable"
- the list's last row when scrolled to the end (T-021)
- an open note's **Save** button when its row is at the bottom (T-022)

## Requirements

**R1.** While the panel is shown, the dock sits clear of it, over the reader, with the
same 20px it keeps from the window's edge otherwise.

**R2.** No script change and nothing the page observer can see: the dock's position
follows from CSS alone.

**R3.** Below 768px nothing changes. The panel is full width there, phones are not a
target (AGENTS.md), and the phone rules in `content.css` stand.

## Fix

`content.css`, beside the dock's own rules:
`body:has(> #bb-panel:not([hidden])) > #bb-dock { right: calc(var(--bb-panel-w, 30%) + 20px); }`
from 768px. `--bb-panel-w` is the panel's clamped width, declared on `body`.

## Acceptance

- [x] With the panel open, the dock sits left of the panel and nothing in the panel is
      under it, pinned and unpinned
- [x] With the panel closed, the dock is back in the window's corner
- [x] The dock's switches still work, and so do `Alt+P` / `Alt+A` / `Alt+S`

## Test it by hand

1. **Load the change.** `chrome://extensions` → BibleBoost → the reload arrow, then
   reload every bible.com tab that was open.
2. A maximised window on `/bible/339/EXO.13.TAOVBSI?parallel=114`. The dock is at the
   window's bottom-right corner. Click the slim **B** tab: the panel opens and the dock
   moves left, to just beside the panel's left edge, clear of it. Trash a note in the
   panel: the toast's **Undo** is fully visible and clickable.
   → Acceptance: With the panel open, the dock sits left of the panel…
3. Press the panel's pin (pinned beside the page), then unpin it: either way the dock
   stays beside the panel and off it.
   → Acceptance: … pinned and unpinned
4. Click the panel's **×**: the dock goes back to the window's corner.
   → Acceptance: With the panel closed, the dock is back in the window's corner
5. With the panel open, click **Parallel** and **Align verses** in the dock, and press
   `Alt+P` / `Alt+A` / `Alt+S`: each works as before.
   → Acceptance: The dock's switches still work…

## Notes

Fixed in the same change as T-022's switch to a Save button, at the user's request.
During a drag of the panel's edge the dock does not follow the preview width; it moves
when the drag ends, which is when the width is stored.

**Checked by hand by the user, 2026-11-12**, as steps 2, 9, 15, 16 and 17 of T-022's
hand-test guide, which cover every step above. All passed in their own Chrome.
