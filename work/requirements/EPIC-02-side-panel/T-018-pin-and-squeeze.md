# T-018 — Pinned squeeze vs unpinned overlay

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Not started |
| Depends on | T-017 |
| Blocks | — |
| Size | M |
| Risk | Medium — touches page layout, which alignment depends on |

## Why

A panel covering the right 30% sits on top of the second version in parallel
mode — exactly the text the user is writing about. Salesforce Inspector can
overlay because Salesforce pages have whitespace; bible.com's reader is centred
and both columns are content.

So: **pinned squeezes the reader, unpinned overlays.** The user gets a quick peek
without reflowing the page, and a working mode where nothing is hidden.

## Scope

**In:** the pin toggle, squeezing the reader, overlaying, and keeping alignment
correct across the transition.

**Out:** resizing (T-019).

## Requirements

**R1.** A pin control in the panel header toggles between:

- **Pinned** — the reader is constrained so the panel sits beside it, not over
  it. No shadow; the panel reads as part of the layout.
- **Unpinned (peek)** — the panel floats over the page with a shadow and the
  reader is untouched.

**R2.** Squeeze by constraining bible.com's own reader wrapper, not by
transforming `body`. A transform would break `getBoundingClientRect()`, which
`align()` and `levelRules()` depend on for their measurements.

Set the constraint with a CSS custom property on `documentElement` and a single
rule in `content.css`, so there is one place that does it and one place to
undo it.

**R3. Alignment must stay correct after the reflow.** The existing
`ResizeObserver` on the columns should fire and re-run `align()` — **verify this
actually happens** rather than assuming. If it does not, call `schedule()`
explicitly after the width change.

**R4.** Restore the page exactly on unpin, on close, and on page unload. Remove
the property; leave no inline styles on bible.com's elements. A user who disables
the extension must not find a narrowed reader.

**R5.** Pinned state persists in `chrome.storage.local` per T-017's R4.

**R6.** Squeezing is **disabled below the tablet breakpoint**. bible.com already
goes single-column and hides the second version there; there is nothing to
squeeze into. Below that width the panel is full-width overlay only, and the pin
control is hidden rather than shown-and-broken.

**R7.** Transition the width change, and honour `prefers-reduced-motion` — put
the override last in the file, as `content.css` already does.

**R8.** Pinning must not change the scroll position. The verse the user was
reading should stay where it was.

## Files

- `src/content/panel-host.js`
- `content.css` — the squeeze rule
- `src/ui/panel.js` — the pin control

## Reference

- `work/understandings/bible-com/03-columns-and-versions.md` — the second column
  disappears on narrow screens
- `work/understandings/bible-com/04-section-headings.md` — why alignment
  measurement is order-sensitive and must not be disturbed
- `work/understandings/bible-com/01-urls-and-routing.md` — the ResizeObserver and
  how `schedule()` is driven
- `work/understandings/conventions/02-css-and-theming.md`

## Acceptance

- [ ] Pinned at 1400px: both parallel columns are fully visible, none clipped
- [ ] After pinning, verses are still correctly aligned and separators still line
      up across columns
- [ ] After unpinning, alignment is still correct
- [ ] Unpinned, the panel overlays with a shadow and the reader does not move
- [ ] Closing the panel restores the page exactly — no leftover width constraint,
      no inline styles on bible.com elements
- [ ] Disabling the extension with the panel pinned leaves a normal page
- [ ] Below the tablet breakpoint, the pin control is hidden and the panel is
      full-width
- [ ] Pinning does not jump the scroll position
- [ ] With `prefers-reduced-motion`, there is no width transition

## Notes

**What T-017 left for R5 (review, 2026-11-10).** `panel-host.js` stores `panelPinned`
and has a `pin` handler, and that is all. Nothing in `panel.js` sends `pin`, and the
host's `state` message carries `open` only, so a restored `panelPinned` never reaches
the panel. This task has to add the sender and put `pinned` in `state`. The `pin`
handler writes storage on the panel's say-so, which is safe only because the host now
checks `event.source` as well as the origin (B-012).

R3 is the one to actually test rather than reason about. The ResizeObserver
watches the **column elements** — if squeezing changes an ancestor's width in a
way that does not resize those specific elements, it will not fire.
