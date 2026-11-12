# T-021 — Compact note list

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Done |
| Depends on | T-005, T-017 |
| Blocks | T-022, T-023 |
| Size | M |
| Risk | Low |

## Why

This is the panel's main view and the first real use of `src/ui/app/`, which the
full page (EPIC-03) will share. Getting the list component right here means
EPIC-03 is mostly layout.

The user's constraint is explicit: *"side panel should be compact as possible,
dont make it look overloaded."* Treat it as a hard requirement.

## Scope

**In:** the list, the row, empty and loading states, virtualization, and the
shared module structure.

**Out:** editing (T-022), filtering by chapter (T-023), search (EPIC-05).

## Requirements

**R1.** Build it in `src/ui/app/list.js` as a module the full page will import
unchanged. Layout and density differ between hosts; behaviour does not.

**R2. A row is exactly four things:** the verse reference, a **two-line** body
preview, a topic colour dot, and tag chips. Nothing else at rest. No buttons, no
timestamps, no version badges competing for attention.

**R3.** Actions appear on **hover and on focus** — edit, delete, open in full
page. Focus matters as much as hover; a hover-only control is unreachable by
keyboard.

> **Amended 2026-11-11.** Only **delete** is drawn in this task. Edit is T-022's
> (R1 there: click a row to expand it in place), and open in full page needs
> `notes.html`, which T-025 creates. A button that does nothing is worse than none,
> so each arrives with the task that gives it something to do. Delete moves the
> note to Trash with no Undo until T-022's R5, by the user's choice.

**R4.** The reference uses `displayRef` when present, falling back to
`formatRange(verseKeys)` from `src/shared/refs.js`.

> **Amended 2026-11-11.** `displayRef` is stored per verse, so the first verse's
> alone would call a three-verse note "…13:2". The reference is
> `captionOf(note.verses)`, now exported by `src/shared/refs.js`: the version's own
> heading with the verse runs collapsed ("யாத்திராகமம் 13:2-4"), falling back to
> `formatRange`'s USFM whenever any verse lacks a usable `displayRef`. It is the
> save popover's caption logic, and `test/save-popover.test.js` holds the two
> copies together. A note with no verse shows its title.
>
> **Later, T-022 R11 (2026-11-12).** A note with a verse and a title now shows the
> title too, in bold at the start of the two-line preview. Same four things, same
> fixed height. The user found titles shown nowhere once the panel could edit them.

**R5.** The preview is **Markdown source, truncated** — not rendered. Rendering
every row's Markdown is wasted work for two lines of text, and raw source is
perfectly readable at preview length. Strip leading `#` and list markers so a
heading does not read as noise.

**R6.** Clamp the preview with `-webkit-line-clamp: 2` rather than truncating the
string, so wrapping behaves correctly in Tamil and English alike. Character-count
truncation is wrong for scripts with combining marks.

**R7. Virtualize above ~200 rows.** Render only what is visible plus a small
buffer. The panel is narrow, so rows are tall and a few hundred notes is a lot of
DOM.

**R8.** Default sort is `updatedAt` descending, using the `byUpdated` index — do
not load everything and sort in memory.

**R9.** Subscribe to `notesRev` in `chrome.storage.local` and patch the affected
rows using `notesRevIds`. Do not refetch the whole list on every change.

**R10.** Empty state is specific and actionable — "No notes yet. Select a verse
and choose Save to BibleBoost." — not a bare "No results". Distinguish "no notes
at all" from "no notes match this filter".

**R11.** Loading state must not flash. Render nothing for the first ~150ms; most
queries will be faster than that and a flashing skeleton looks broken.

**R12.** Full keyboard navigation: arrows move, Enter opens, Delete trashes.

> **Amended 2026-11-11.** Enter, and a click on a row, call the list's `onOpen`
> hook, which does nothing until T-022 fills it with the inline editor. So the
> Enter half of the last keyboard box belongs to T-022, and its Acceptance says so.

## Files

- `src/ui/app/list.js` — new, shared
- `src/ui/app/store.js` — new, messaging and `notesRev` subscription
- `src/ui/panel.js`, `src/ui/ui.css`
- `src/ui/panel.html` — links `ui.css`, and `<main>` now hands scrolling to the list
- `src/shared/refs.js` — `captionOf`, for R4 as amended
- `test/list.test.js` — new, the preview; `test/refs.test.js` and
  `test/save-popover.test.js` — `captionOf`, and the two copies held together

## Reference

- `work/understandings/extension/03-messaging.md` — `notes/list` and the
  `notesRev` signal
- `work/understandings/extension/02-storage-model.md` — the note shape, indexes
- `work/understandings/bible-com/07-i18n-and-scripts.md` — why R6 avoids
  character counting
- `work/understandings/conventions/02-css-and-theming.md`

## Acceptance

- [x] A row shows reference, two-line preview, topic dot and tags — and nothing
      else until hovered or focused
- [x] Actions are reachable by keyboard, not only by hover
- [x] A Tamil note's preview clamps cleanly with no broken glyphs
- [x] 500 notes scroll smoothly; the DOM holds far fewer than 500 rows
- [x] Creating a note elsewhere makes it appear without a manual refresh
- [x] Editing a note updates that row only — verify the others are not re-created
- [x] Empty-with-no-notes and empty-with-filter show different messages
- [x] A fast query shows no loading flash
- [x] Arrows and Delete work (Enter reaches the `onOpen` hook; that it opens
      anything is T-022's box)
- [x] At the 280px minimum width, nothing overflows or overlaps

## Test it by hand

The panel's Console is used in several steps. Right-click inside the panel →
**Inspect**. DevTools opens on **Elements**, so click the **Console** tab. Run
`location.pathname`: it must print `'/src/ui/panel.html'`. If it prints the
bible.com path, use the context dropdown at the Console's top left and pick the
entry for the panel's frame. Every snippet below goes in on one line, as given.

1. **Load the change.** `chrome://extensions` → BibleBoost → the reload arrow, then
   reload every bible.com tab that was open.
2. **Starting state.** A maximised window on
   `https://www.bible.com/bible/339/EXO.13.TAOVBSI?parallel=114`, either theme.
   Click the slim **B** tab on the right edge. If you have no notes yet, save three
   first: tap a verse → **Save to BibleBoost** → **Save**. Make one a run of three
   verses (tap three in a row before saving), and give one a long body in Tamil.
3. Look at a row. It shows a small topic dot (a hollow ring for no topic), the
   reference in the page's own book name (the three-verse note reads like
   "யாத்திராகமம் 13:2-4"), its tags as small grey pills beside it, and two lines of
   the note. Nothing else. Point at a row: a trash icon appears at its top right.
   Move away: it goes.
   → Acceptance: A row shows reference, two-line preview, topic dot and tags — and nothing else until hovered or focused
4. Click the panel's **BibleBoost** title, then press **Tab** until a row gets a
   blue outline (after the pin and the **×**). The trash icon shows on that row.
   Press **Tab** once more: the trash icon itself is outlined. **Shift+Tab** goes
   back to the row. → Acceptance: Actions are reachable by keyboard
5. On an outlined row: **↓** and **↑** move the outline row by row, **End** jumps
   to the last note and **Home** to the first. **Enter** does nothing yet, which is
   expected until T-022. On a note you can spare, press **Delete**: its row
   disappears and the row below takes the outline. To bring it back, run in the
   panel's Console:
   `const { notes: [n] } = await chrome.runtime.sendMessage({ type: 'notes/list', filter: { trashed: true }, page: { limit: 1 } }); await chrome.runtime.sendMessage({ type: 'notes/restore', ids: [n.id] });`
   It reappears where it was.
   → Acceptance: Arrows and Delete work (Enter reaches the `onOpen` hook; that it opens anything is T-022's box)
6. With the panel open, tap a verse in the reader → **Save to BibleBoost** →
   **Save**. The new note appears at the top of the list on its own, with no
   refresh. → Acceptance: Creating a note elsewhere makes it appear without a manual refresh
7. That new note is the one to edit. In the panel's Console run
   `const rows = [...document.querySelectorAll('.bb-row')]; const first = rows.find((r) => r.getAttribute('aria-posinset') === '1'); await chrome.runtime.sendMessage({ type: 'notes/update', id: first.dataset.id, patch: { body: 'Edited from the console' } });`
   The top row now reads "Edited from the console". Then run
   `rows.filter((r) => !r.isConnected).length`: it prints **0**, so no other row was
   rebuilt. → Acceptance: Editing a note updates that row only — verify the others are not re-created
8. **500 notes.** In the panel's Console, add 500 test notes, all tagged `bbtest`:
   `for (let i = 1; i <= 500; i++) await chrome.runtime.sendMessage({ type: 'notes/create', draft: { source: 'panel', body: 'Test note ' + i + ': முதற்பேறான யாவையும் எனக்குப் பரிசுத்தப்படுத்து', tags: ['bbtest'] } });`
   They stream in at the top. Scroll the list from top to bottom with the wheel and
   the scrollbar: it stays smooth. Run `bbPanel.list.stats`: `total` is over 500
   and `rows` is about 20. Then remove the test notes for good. This deletes only
   notes tagged `bbtest`:
   `const { notes } = await chrome.runtime.sendMessage({ type: 'notes/list', filter: { tag: 'bbtest' }, page: { limit: 500 } }); const ids = notes.map((n) => n.id); await chrome.runtime.sendMessage({ type: 'notes/trash', ids }); await chrome.runtime.sendMessage({ type: 'notes/purge', ids }); await chrome.runtime.sendMessage({ type: 'tags/delete', name: 'bbtest' });`
   → Acceptance: 500 notes scroll smoothly; the DOM holds far fewer than 500 rows
9. In the panel's Console run `bbPanel.list.setFilter({ tag: 'no-such-tag' })`: the
   panel says **No notes match this filter.** Run `bbPanel.list.setFilter({})` to go
   back. The other message, **No notes yet. Select a verse and choose Save to
   BibleBoost.**, shows only when there are no notes at all. If you have notes,
   say so and leave that half to the stand-in check in Notes.
   → Acceptance: Empty-with-no-notes and empty-with-filter show different messages
10. Press **F5** with the panel open and watch it as the page comes back. The list
    appears with no "Loading…" blinking first.
    → Acceptance: A fast query shows no loading flash
11. Drag the panel's left edge as far right as it goes (280px, T-019). Find the
    Tamil note with the long body: its preview is two lines ending in "…", and no
    letter is cut at its top or bottom. **Ctrl +** to zoom in for a close look,
    **Ctrl 0** to go back.
    → Acceptance: A Tamil note's preview clamps cleanly with no broken glyphs
12. Still at 280px: the header fits on one line, nothing scrolls sideways, each
    row's reference and tags share one line, with the tags fading out at the right,
    and every row is the same height.
    → Acceptance: At the 280px minimum width, nothing overflows or overlaps
13. **Standing regression** on `/bible/339/EXO.13.TAOVBSI?parallel=114`: verses
    align, separators draw, `Alt+P` / `Alt+A` / `Alt+S` work, and changing the
    reader's "Aa" size re-aligns.

On a failure, send the step number and what you saw instead, a screenshot, and
anything red in the panel's Console.

## Notes

**Checked by hand by the user, 2026-11-11 and 2026-11-12.** The arrows-and-Delete
and created-elsewhere boxes were ticked on 2026-11-11, after the steps for them
worked. The rest were ticked on 2026-11-12, when the user reported every remaining
step working, standing regression included. That covers the Tamil preview at
280px: the fixed 20px line held Tamil without clipping in the user's own Chrome
and fonts.

Two things the hand test turned up, both fixed the same day:

- **Delete sometimes left the row on screen.** The note went to Trash, but its row
  stayed, focused. When the trash signal arrived within `OVERTAKE_MS` of a page
  answer, or in any filtered list, the list reloaded instead of patching. `draw()`
  keeps a focused row whose note it still has (review fix 9), so it kept the deleted
  one. `reloadWithout()` now takes trashed and purged notes off screen and out of the
  model at once, emptying their positions without moving the others. Reproduced in
  the stand-in (5 rows for a total of 4), then checked on four paths: normal, right
  after a page, from the trash button, and filtered. Each time the row went and focus
  landed on the next row. The user's later retry worked.
- **The step 7 snippet named a variable `top`**, which the console refuses at top
  level because `window.top` already exists. It is `first` now. See
  `03-task-workflow.md`.

**Built 2026-11-11, alongside T-019 and T-020.** No box was ticked at build time:
each names the panel in the real extension, which is the user's Chrome.

- **`src/ui/app/list.js`** is the shared list, with no layout of its own beyond
  `ui.css`. Rows are keyed by note id and are only moved and repainted, never
  rebuilt. Every row is one fixed height, 78px, read off a real row. Below 200
  rows all are drawn, and above that a window plus 8 rows each way (R7). Pages of
  100 come newest first from `byUpdated`, asked for as the window nears them (R8).
- **`src/ui/app/store.js`** is the only line to the worker, and `onNotesChange()`
  hands the list `{ kind, ids }` (R9). A create or an edit is fetched with
  `notes/get` and placed at the top. A trash or purge removes rows. A restore, a
  topic or tag change, or anything it cannot place reloads what is on screen.
- **The head line carries the dot, the reference and the tags**, and the preview
  the two lines below. So a row is three lines, not four, and the chips are
  clipped with a fade rather than wrapped, which would break the fixed height.
- **Line heights are lengths, 20px for 13px text**, an exception to the
  "`normal` on small text" rule that `02-css-and-theming.md` now records. In the
  built-in browser, Tamil and Latin at 13px in the panel's font stack both measured
  a 17.33px `normal` line, and nothing was clipped at 20px. Step 11 is the real
  test, with the user's fonts.
- **A note with no body previews its verse**, in the secondary colour, rather than
  two blank lines.
- **A brand-new tag refreshes the labels.** Saving a note with a tag nobody had
  used creates that tag in the same write, which the worker reports as `create`,
  not `tags`. Until the list noticed, the chip showed the folded name, "faith" for
  "Faith". Now a note carrying an unknown tag or topic refreshes the lookups before
  it is drawn. Found on a second read, 2026-11-11, and checked in the stand-in.
- **The trash button sits over the row's top right on hover and focus**, on the
  row's own fill. At 280px it can cover the end of a long reference while it is
  shown. That is a deliberate overlay, not an overflow.
- **For T-022:** expanding a row in place gives one row a different height, and
  the virtual list assumes one height for all. The list needs to learn one tall
  row, at the open row's index, before T-022's R1 can work above 200 notes. Undo
  for Delete is also T-022's (R5 there), and `onOpen` is where its editor goes.

**Checked through a stand-in on 2026-11-11.** The real panel ran with the real
worker and real IndexedDB on localhost, and was framed by the reader stand-in on a
second port, at 1400 × 900; the recipe is in `03-task-workflow.md`.

- 500 notes were created while the list was open. Its order then matched a fresh
  `notes/list` exactly, and the DOM held 18–28 rows.
- An edit from another context moved that note to the top, with every row element
  still the same object.
- ↓ thirty times, End (which loaded page 400 on demand) and Home all moved focus,
  with one tab stop.
- Delete trashed the note and moved focus to the row that took its place, and
  `notes/restore` brought it back.
- At 280px nothing in the frame scrolled sideways and no part of a row stuck out of
  it. A topic colour of `url(javascript:…)` was refused and drawn as a plain dot.
- A filter with no match said "No notes match this filter.", and an empty database
  said "No notes yet…".
- A fast answer never showed "Loading…", and an answer held back 2s showed it from
  about 150ms until the list arrived.

**An independent review found nine bugs, all fixed the same day** (2026-11-11), and
each fix was rechecked in the stand-in with 300+ notes:

1. **Restoring the only note left "No notes yet" on screen.** `reload()` drew, and
   an empty list draws no window to ask for. It now asks for the first page
   directly. Checked: create, trash, restore, and the row came back.
2. **A failing page was asked for again at once, forever,** a tight loop when the
   extension has gone and every answer is an immediate error. A page that fails, or
   answers short, is not asked again until the next change, reload or filter.
   Checked: one request while every answer failed, and recovery on the next change.
3. **The tab stop was a position**, so a note created above the focused row handed
   it to the neighbour. It is a note id now, set by the arrow keys as well as by
   `focusin`, which a page without window focus never receives. Checked: focus on
   row 10, a note created elsewhere, and the tab stop moved with it to row 11.
4. **A change could be applied twice.** A page can be worked out after a write and
   still arrive before that write's signal, and patching on top of it would drop a
   note and leave the total one short. A change within 500ms of a page answer now
   reloads instead of patching. Checked: a change 150ms after a page reloaded, one
   1.6s after was patched, and top, middle and bottom then matched the worker exactly.
5. **A pending End could fire much later** and move focus with no key pressed. Any
   change, reload or filter now cancels it. Checked with a page held back 1.5s.
6. **Trashing a filter's last match said "No notes yet"**. A filtered list now
   reloads on a removal, as it already did on a create. Checked.
7. **Geometry.** The row's 4px top margin was not in the measured height, so End
   left the focused row's bottom 4px off screen. It is now an `INSET` in each row's
   position. Separately, the resize grip reached 7px into the frame, past the
   rows' 4px inset, so a press on a row's left edge started a resize. The grip now
   lies 12px over the page and 4px over the panel, 3px of it inside the frame.
   Checked: after End the last row ends at the view's bottom, to the pixel.
8. **A topic or tag change while a list was loading was dropped**, labels included.
   It now refreshes the labels and asks again whatever the list is doing.
9. **Focus could fall to the page during a reload** when the focused note moved
   from one page to the next between their answers. The focused row is now kept
   until its note is placed again, or is really gone.

The last item is the real compactness test. Design at 280px first and let it
breathe at wider sizes — the reverse always produces a cramped minimum.
