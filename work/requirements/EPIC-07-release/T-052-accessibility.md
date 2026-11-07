# T-052 — Accessibility pass

| Field | Value |
|---|---|
| Epic | EPIC-07 Polish and release |
| Status | Not started |
| Depends on | T-025, T-035 |
| Blocks | — |
| Size | M |
| Risk | Low |

## Why

The existing code already does this well — `role="switch"` with `aria-checked`,
`aria-label` carrying the real name while visual labels are hidden from assistive
tech, `prefers-reduced-motion` honoured, measured contrast recorded in comments.
The notes feature adds far more interactive surface than the dock ever had, and
should not lower that bar.

A sweep at the end catches what task-by-task attention misses, particularly
focus order across three panes and two hosts.

## Scope

**In:** an audit and fixes across the panel, the notes page, the save popover and
the injected menu row.

**Out:** anything inside bible.com's own UI.

## Requirements

**R1. Keyboard reachability.** Every action must be possible without a mouse.
The specific risk is T-021's hover-revealed row actions — they must appear on
**focus** as well as hover, or they are unreachable.

**R2. Focus order follows visual order** in all layouts: three panes, two panes,
one pane, and the panel at its minimum width.

**R3. Focus management** in every overlay — the save popover, confirm dialogs,
the import preview. Focus moves in on open, is trapped while open, returns to the
trigger on close. Escape closes and cancels; it never confirms.

**R4. Visible focus indicators** everywhere, using the existing `--bb-focus`
token. Never remove an outline without replacing it.

**R5. Semantics, not divs.** Buttons are `button`, the note list is a list,
headings are headings. Follow the existing code's pattern of expressing state
with ARIA and data attributes rather than modifier classes.

**R6. Labels on everything** — icon-only buttons need `aria-label`, the search
input needs a label, the colour pickers need accessible names, and colour must
never be the only carrier of meaning (topic dots need a name as well).

**R7. Live regions**: the toast is `role="status"` `aria-live="polite"` (T-035's
R8); save state and result counts announce politely. Nothing announces so often
that it becomes noise.

**R8. Contrast** of at least 4.5:1 for text and 3:1 for UI boundaries, in **both
themes**. Measure it and record the numbers in comments, as `content.css`
already does. This is how the `--bb-track-on` departure was justified.

**R9. `prefers-reduced-motion`** honoured in every new stylesheet, with the
override last in the file, as the existing code does.

**R10.** Test with an actual screen reader — NVDA on Windows — for at least:
saving a verse, finding a note by search, editing it, deleting and undoing.
Automated checks do not catch a flow that is technically labelled and
incomprehensible.

**R11.** Verify at 200% browser zoom and with a large OS font. The compact panel
is where this breaks first.

## Files

- `src/ui/ui.css`, `src/ui/app/*`, `src/content/*`, `popup.html`

## Reference

- `work/understandings/conventions/02-css-and-theming.md` — ARIA-over-classes,
  measured contrast, reduced motion
- `work/understandings/bible-com/05-theme-and-page-chrome.md` — both themes
- `work/understandings/conventions/01-code-style.md`

## Acceptance

- [ ] Every action in panel and notes page is reachable by keyboard alone
- [ ] Row actions appear on focus, not only on hover
- [ ] Focus order matches visual order in all four layouts
- [ ] Every dialog traps focus, restores it, and closes on Escape **without**
      confirming
- [ ] Focus indicators are visible on every control in both themes
- [ ] Icon-only buttons have accessible names
- [ ] Topic colour is never the only indicator of topic
- [ ] Toast, save state and result counts announce politely
- [ ] Contrast measured and recorded; all text ≥ 4.5:1 in both themes
- [ ] `prefers-reduced-motion` honoured everywhere
- [ ] The five flows in R10 are navigable with NVDA
- [ ] Usable at 200% zoom and at the panel's 280px minimum

## Notes

R1 is the highest-value item. The compact-list design deliberately hides actions
until hover, which is good for compactness and inaccessible unless focus reveals
them too.
