# T-013 — Inject the save row into bible.com's verse menu

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Not started |
| Depends on | T-004, T-008 |
| Blocks | T-014 |
| Size | M |
| Risk | **High** — the most redesign-fragile code in the project |

## Why

This is the requested entry point: a save option in the same menu as Highlight,
Copy, Compare and Share, so saving a verse is one tap from where the user already
is.

It is also the code most likely to break without warning. The menu stays mounted
off-screen between selections, redraws parts of itself on every selection, and
its class names can change with any build (T-008 recorded the real structure in
`06-verse-action-menu.md`).
T-015 exists so that when this breaks, the feature degrades instead of dying.

## Scope

**In:** finding the menu, inserting one row, keeping it inserted, and removing it
cleanly.

**Out:** what the row *does* when clicked (T-014).

## Requirements

**R1.** `src/content/menu.js` watches for the popover appearing and inserts a
single row labelled "Save to BibleBoost", with an icon, positioned **between
Highlight and Copy** (the user's stated preference).

**R2. Anchor positionally, never by text.** Do **not** match the English word
"Copy". The interface language is independent of the Bible version, so matching
English labels is a localization bug waiting to happen. Identify the action
list's container and insert by index relative to its children.

**R3. Always insert.** If the anchor cannot be found, **append at the end of the
list**. If the list cannot be found, do nothing and log — never throw, and never
leave the menu visually broken.

**R4. Idempotent.** The popover stays mounted, so a row inserted once is still
there on the next selection unless the site redraws that part of it. Before
inserting, check for an existing node by `[data-bb-own]`. Never insert twice.

**R5. Mark it `data-bb-own`.** Mandatory — this is what lets the T-004 guard stop
the injected row from re-triggering `align()`. Without it, every selection runs a
full alignment pass.

**R6. Match the menu's own styling**, using `--bb-*` tokens: same row height,
padding, icon size, font and hover treatment as its neighbours. The row should
look native, not bolted on. Respect `html.dark` / `html.light`.

**R7. Build with `createElement` + `textContent`.** Never `innerHTML` — this is a
hard project rule and the label will eventually be user-influenced.

**R8. Never remove, re-order or re-render bible.com's own rows.** Additive only.
Highlight, Copy, Compare and Share must keep working exactly as before. This is
the project's founding rule.

**R9.** Keyboard accessible: a real `button`, reachable by Tab, activated by
Enter and Space, with a sensible accessible name.

**R10.** Clean up on removal — no leaked listeners, no orphan nodes when the
popover closes.

## Files

- `src/content/menu.js` — new
- `src/shared/theme.css` — any new tokens
- `manifest.json` — add to the `js` array

## Reference

- `work/understandings/bible-com/06-verse-action-menu.md` — the real structure,
  verified during T-008, and the agreed integration strategy. Re-check the action
  list before coding: T-008 only needed the header.
- `work/understandings/extension/04-observer-hazards.md` — why R5 is mandatory
- `work/understandings/conventions/02-css-and-theming.md` — token usage, theme
  layers
- `work/understandings/conventions/01-code-style.md` — hard rules 1 and 2

## Acceptance

- [ ] Selecting a verse shows the row between Highlight and Copy
- [ ] It looks native in both bible.com themes
- [ ] Highlight, Copy, Compare and Share all still work
- [ ] Selecting ten verses in a row inserts exactly one copy each time — never
      two, never zero
- [ ] Closing and reopening the menu re-inserts correctly
- [ ] After client-side chapter navigation, injection still works
- [ ] With `DEBUG_SCHEDULE = true`, opening and closing the menu repeatedly does
      **not** spam `schedule()`
- [ ] Tab reaches the row; Enter and Space activate it
- [ ] Simulating a failed anchor lookup appends the row at the end instead of
      failing
- [ ] `work/understandings/bible-com/06-verse-action-menu.md` updated with the
      real selectors and its confidence banner changed

## Notes

Expect this to need revisiting. Keep the selector knowledge in the understanding
file, not scattered in comments, so the next repair is a one-file change.
