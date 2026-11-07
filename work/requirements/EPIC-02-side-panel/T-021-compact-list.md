# T-021 — Compact note list

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Not started |
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

**R4.** The reference uses `displayRef` when present, falling back to
`formatRange(verseKeys)` from `src/shared/refs.js`.

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

## Files

- `src/ui/app/list.js` — new, shared
- `src/ui/app/store.js` — new, messaging and `notesRev` subscription
- `src/ui/panel.js`, `src/ui/ui.css`

## Reference

- `work/understandings/extension/03-messaging.md` — `notes/list` and the
  `notesRev` signal
- `work/understandings/extension/02-storage-model.md` — the note shape, indexes
- `work/understandings/bible-com/07-i18n-and-scripts.md` — why R6 avoids
  character counting
- `work/understandings/conventions/02-css-and-theming.md`

## Acceptance

- [ ] A row shows reference, two-line preview, topic dot and tags — and nothing
      else until hovered or focused
- [ ] Actions are reachable by keyboard, not only by hover
- [ ] A Tamil note's preview clamps cleanly with no broken glyphs
- [ ] 500 notes scroll smoothly; the DOM holds far fewer than 500 rows
- [ ] Creating a note elsewhere makes it appear without a manual refresh
- [ ] Editing a note updates that row only — verify the others are not re-created
- [ ] Empty-with-no-notes and empty-with-filter show different messages
- [ ] A fast query shows no loading flash
- [ ] Arrows, Enter and Delete all work
- [ ] At the 280px minimum width, nothing overflows or overlaps

## Notes

The last item is the real compactness test. Design at 280px first and let it
breathe at wider sizes — the reverse always produces a cramped minimum.
