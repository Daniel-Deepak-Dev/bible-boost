# T-035 — Undo toast on every soft delete

| Field | Value |
|---|---|
| Epic | EPIC-04 Organization |
| Status | Not started |
| Depends on | T-022 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

This is the policy decision made at planning time, made consistent: **soft delete
plus undo beats a confirm modal.** A confirm dialog interrupts the common case
(the user meant it) and barely protects the rare one (they clicked by accident
and will click Yes by reflex). Undo does the opposite — no interruption when
right, genuine recovery when wrong.

The requirement was "proper CRUD with necessary warnings". This task is what
makes "necessary" an honest word rather than a blanket.

## Scope

**In:** one shared toast component, used everywhere a reversible destructive
action happens.

**Out:** the confirm dialogs for irreversible actions (T-032, T-034).

## Requirements

**R1.** `src/ui/app/toast.js` is **the** toast, used by the panel, the full page
and the save popover. One component, one behaviour, one place to fix.

**R2.** Shown after: trashing a note, trashing several, deleting a topic,
deleting a tag, bulk move, bulk retag. Duration ~5 seconds.

**R3.** The message names what happened with a count — "3 notes moved to Trash",
not "Done" — and carries one **Undo** action.

**R4.** Undo restores the **previous state**, not the inverse action. Three notes
from three different topics, moved and then undone, go back to their three
original topics. Capture prior state before the write. (Same rule as T-027's R6
and T-032's R6; implement it once, in `repo.js`.)

**R5.** Several toasts stack rather than replacing each other, newest at the
bottom, capped at about three with older ones collapsing.

**R6.** The timer **pauses on hover and on focus**. A user reaching for Undo
should not lose the chance because the mouse travel took five seconds.

**R7.** Dismissible, and never covers the list's last row or a primary action.

**R8.** `role="status"` with `aria-live="polite"`, and the Undo button reachable
by keyboard. A toast that screen-reader users cannot perceive or act on is not a
safety net for them.

**R9.** On expiry the action stands — the note stays in Trash (recoverable there,
per T-034), the topic stays deleted. Expiry is not a second confirmation.

**R10.** Respect `prefers-reduced-motion`: fade only, no slide.

**R11.** In the panel, position it inside the panel, not over bible.com — a toast
escaping the iframe would need page-side DOM and a `data-bb-own` marker, which is
avoidable complexity for no benefit.

## Files

- `src/ui/app/toast.js` — new, shared
- `src/background/repo.js` — prior-state capture and undo tokens
- `src/ui/ui.css`

## Reference

- `work/requirements/EPIC-04-organization/EPIC.md` — the warning policy
- `work/understandings/extension/03-messaging.md` — `notes/trash` returns an
  `undoToken`
- `work/understandings/extension/02-storage-model.md` — soft delete

## Acceptance

- [ ] Deleting one note shows a toast; Undo restores it fully
- [ ] Deleting three shows the count; Undo restores all three
- [ ] Moving notes from different topics and undoing returns each to its original
      topic
- [ ] Hovering pauses the timer; leaving resumes it
- [ ] Keyboard focus also pauses it, and Undo is reachable by Tab
- [ ] Three rapid deletes stack rather than replacing
- [ ] After expiry the note is in Trash and restorable there
- [ ] The toast never covers the last list row
- [ ] A screen reader announces it
- [ ] With `prefers-reduced-motion`, it fades without sliding
- [ ] In the panel it stays inside the panel

## Notes

R6 is small and is the difference between a real safety net and a decorative
one. Five seconds is less time than it sounds when the user is reading the
message to decide.

R1 cannot hold for the save popover. `src/ui/app/toast.js` will be an ES module and
a content script is a classic script, so `src/content/save-popover.js` carries its
own small toast (T-014). It is the same idea in about twenty lines, and it has no
stacking.

**What T-022 already built (2026-11-12).** `src/ui/app/toast.js` exists and the
panel uses it: one Undo action per toast, a × to dismiss, newest at the bottom,
capped at three (the oldest goes), the timer re-arming while the toast is hovered or
holds focus, a polite live region created empty, a fade with none under reduced
motion, and in the panel it sits in the flow under the list. The messages carry a
count (`trashedMessage`, `restoredMessage` in `src/ui/app/trash.js`). Left for this
task: R2's other callers (topics, tags, bulk move and retag), R4's prior-state undo
in `repo.js`, and its own Acceptance, none of which T-022 ticked.
