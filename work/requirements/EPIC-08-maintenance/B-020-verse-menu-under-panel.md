# B-020 — bible.com's verse menu sits partly under the side panel

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Found by T-018 |
| Blocks release | No |
| Depends on | T-017 |
| Size | S |
| Risk | Medium — the fix has to reach a bible.com element by structure |

## The problem

bible.com's verse action menu (Highlight, Copy, Compare, Share, and BibleBoost's own
Save row) is a 480px card centred in a **fixed** box. Measured on 2026-11-10 at
1400x900 on `/bible/339/EXO.13.TAOVBSI?parallel=114`:

| Box | Spans |
|---|---|
| the menu's fixed root, `inset-inline-start: var(--rail-w)` and `inset-inline-end: 0` | 220–1385px |
| the card, `md:w-[480px]`, centred in it | 562–1042px |
| the panel at 30%, from T-017 | 969–1385px |

So the panel covers the card's right 73px, and the card's top-right corner holds its
**Cancel** button. The panel's `z-index` (2147482000) is far above the menu's.

Pinning does not help. T-018 narrows `body`, and a fixed box is placed against the
window, not against `body`, so the menu stays where it was while the reader moves left.
Unpinned it is the same overlap, which has existed since T-017.

Derived from the measured geometry rather than measured at each width: with the 220px
rail, the card's right edge is `(220 + W) / 2 + 240` and the panel's left edge is
`0.7 W`, so they overlap at every window width `W` below about 1750px. Below 1024px the
rail is gone (`lg:` classes), the root starts at 0, and they overlap below about 1200px,
which is every width where the panel is not already full-width.

## Scope

**In:** the menu being reachable whole while the panel is open, pinned or not.

**Out:** the panel's width (T-019), and anything inside the menu, where the Save row is
T-013's.

## Options, none chosen

1. **Move the menu's root.** A rule that sets its `inset-inline-end` to the panel's
   width while the panel is open. It has to find the root by structure: it is the fixed
   child of the reader that is not the columns' wrapper (`06-verse-action-menu.md`).
   bible.com's utility classes are a description there, not a selector.
2. **Drop the panel below the menu while a verse is selected.** `capture.js` already
   knows when a selection exists. The menu would then cover the panel's left edge
   instead, which is the panel's own content.
3. **Accept it** and record that tapping the verse again deselects it, which is what
   Cancel does.

## Files

Depends on the option. 1 is `content.css` and perhaps `panel-host.js`. 2 is
`panel-host.js` and a hook from `capture.js`.

## Reference

- `work/understandings/bible-com/06-verse-action-menu.md` — the menu's structure
- `work/understandings/extension/04-observer-hazards.md` — before adding anything
  that reacts to the selection

## Acceptance

- [ ] With the panel open at 1400px, pinned and unpinned, every control in the verse
      menu, Cancel included, can be clicked
- [ ] The same at 1024px and 800px
- [ ] Highlight, Copy, Compare and Share still work, and so does BibleBoost's Save row
