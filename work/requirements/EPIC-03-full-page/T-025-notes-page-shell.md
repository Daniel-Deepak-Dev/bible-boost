# T-025 — Page shell: topic sidebar, list, editor

| Field | Value |
|---|---|
| Epic | EPIC-03 Full-page app |
| Status | Not started |
| Depends on | T-006, T-021 |
| Blocks | T-026, T-027, T-028, T-029 |
| Size | M |
| Risk | Low |

## Why

The full page is where the user works on notes deliberately rather than
opportunistically. It needs the three-pane shape that every notes application
converges on, because it is the one that supports "browse, pick, write" without
navigation.

The structural requirement is that it reuses the panel's modules rather than
reimplementing them.

## Scope

**In:** the page, its layout, and wiring the existing shared modules into it.

**Out:** the Markdown toolbar (T-026), bulk actions (T-027), filtering (T-028),
topic management UI (EPIC-04).

## Requirements

**R1.** `src/ui/notes.html` + `src/ui/notes.js`, loaded as
`<script type="module">`. Extension pages support native ES modules — no bundler.

**R2.** Three panes:

| Pane | Contents |
|---|---|
| Left | topic tree, Uncategorized, Trash, tag cloud. Collapsible. |
| Centre | the note list — `src/ui/app/list.js`, **the same module as the panel** |
| Right | the editor — `src/ui/app/editor.js`, same module |

**R3.** The list and editor modules are imported **unchanged**. Differences
between hosts are expressed by a density or capability option passed in, never by
forking the module. If something cannot be expressed that way, that is a signal
to fix the module's interface, not to copy it.

**R4.** Responsive: three panes at ≥1280px, two at ≥900px (sidebar collapses to
icons), one at narrower widths (list and editor swap). Panel widths are
draggable and persist in `chrome.storage.local`.

**R5.** `data-theme` on `documentElement` driven by `prefers-color-scheme`, with
a manual light/dark/auto override in `storage.local`. **This page cannot see
bible.com's theme class** — it is a separate tab — so unlike the panel it has no
relay to fall back on.

**R6.** Deep-linkable by hash: `#/note/<id>`, `#/topic/<id>`, `#/trash`,
`#/tag/<name>`. The panel's "open in full page" uses this, and it makes the
browser's back button work sensibly.

**R7.** Subscribe to `notesRev` exactly as the panel does, through
`src/ui/app/store.js`. Editing in the panel must update this page live.

**R8.** Empty state when there are no notes at all: explain how to create one,
including the bible.com flow and the standalone "+".

**R9.** The page title reflects context — "BibleBoost Notes" or "Exodus 13 —
BibleBoost" — so a pinned tab is identifiable.

**R10.** Keyboard: `/` focuses search, `n` creates a note, arrows move the list,
Tab order follows visual order.

## Files

- `src/ui/notes.html`, `src/ui/notes.js` — new
- `src/ui/ui.css` — shared component styles
- `src/ui/app/store.js` — extended with hash routing
- `manifest.json` — `web_accessible_resources` if linked from the content script

## Reference

- `work/understandings/extension/01-architecture.md` — rule 3, one application
  in two hosts
- `work/understandings/extension/03-messaging.md` — `notes/list`, `notesRev`
- `work/understandings/conventions/02-css-and-theming.md`
- `work/understandings/extension/05-mv3-constraints.md` — pages may be modules

## Acceptance

- [ ] The page opens and lists notes
- [ ] The list and editor modules are imported from `src/ui/app/`, with **no
      forked copy** in `notes.js`
- [ ] Layout works at 1920px, 1280px, 900px and 600px
- [ ] Editing a note in the panel updates this page without a refresh, and vice
      versa
- [ ] `#/note/<id>` opens that note directly
- [ ] Back and forward move between notes sensibly
- [ ] Light, dark and auto all render correctly
- [ ] A Tamil note displays correctly in list and editor
- [ ] `/` and `n` work

## Notes

R3 is the one to hold the line on. The pressure to "just copy the list component
and tweak it for the big screen" will be real, and giving in to it is what turns
one application into two.
