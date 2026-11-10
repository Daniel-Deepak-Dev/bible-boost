# T-013 — Inject the save row into bible.com's verse menu

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Done |
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

**R10.** Leave nothing behind. Closing the menu needs no work: it goes off-screen
and `inert` without unmounting, and the row stays in it (R4). Client-side chapter
navigation replaces the whole menu and the row goes with it, so the only listener
lives on the row itself and no reference to the row is kept.

## Files

- `src/content/menu.js` — new
- `src/content/capture.js` — export `menuLinks`, so the header link has one definition
- `content.css` — the row's styling. No new tokens were needed, so
  `src/shared/theme.css` is untouched
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

- [x] Selecting a verse shows the row between Highlight and Copy
- [x] It looks native in both bible.com themes
- [x] Highlight, Copy, Compare and Share all still work
- [x] Selecting ten verses in a row inserts exactly one copy each time — never
      two, never zero
- [x] Closing and reopening the menu re-inserts correctly
- [x] After client-side chapter navigation, injection still works
- [x] With `DEBUG_SCHEDULE = true`, opening and closing the menu repeatedly logs
      no more `schedule()` calls than the same taps with `menu.js` removed from
      the manifest. Every tap logs some, because bible.com's own class writes
      pass the guard
- [x] Tab reaches the row; Enter and Space activate it
- [x] Simulating a failed anchor lookup appends the row at the end instead of
      failing
- [x] `work/understandings/bible-com/06-verse-action-menu.md` updated with the
      real selectors and its confidence banner changed

## Notes

Expect this to need revisiting. Keep the selector knowledge in the understanding
file, not scattered in comments, so the next repair is a one-file change.

Measured on live bible.com on 2026-11-10, logged out, by pasting the code into the
page (`conventions/03-task-workflow.md`): `bible-dom.js`, the selection parts of
`capture.js`, `menu.js`, and the guard and observer from `content.js` with
`schedule()` recording its calls. The alignment code was not loaded for that run.
Five open-and-close cycles came to 20 `schedule()` calls and 875 records with
`menu.js` and without it, in two runs of each. Also checked at 375px wide and under
an `/ar/` interface.

Checked by hand in real Chrome with the extension installed, and reported working
on 2026-11-10: a real click on the row logging the selection, the `Aa` size change,
separators, Highlight, Copy, Compare and Share, the row's place in a signed-in menu,
and the row arriving about 80 ms after the first tap in a chapter. The signed-in
menu's rows were reported, not measured.

`Alt+P/A/S` were left out of the regression check. They were already dead in real
Chrome before this task and are tracked by B-006.
