# EPIC-03 — Full-page notes app

**Goal:** a dedicated page for working on notes properly — writing at length,
reorganising in bulk, and finding things — without bible.com in the way.

The key idea is that this is **not a second application**. `notes.html` and
`panel.html` both load the modules in `src/ui/app/`. They differ in layout and
density, not in behaviour. A feature built in EPIC-02 arrives here nearly free;
a bug fixed here is fixed in the panel too.

What this page has that the panel deliberately does not: room. The Markdown
toolbar, multi-select, bulk actions and rich filtering all live here because they
would violate the panel's compactness requirement.

## Tasks

| Id | Title | Depends on |
|---|---|---|
| [T-025](T-025-notes-page-shell.md) | Page shell: topic sidebar, list, editor | T-006, T-021 |
| [T-026](T-026-markdown-editor.md) | Markdown editor with toolbar and preview | T-025 |
| [T-027](T-027-bulk-actions.md) | Multi-select and bulk actions | T-025 |
| [T-028](T-028-sort-and-filter.md) | Sort and filter | T-025 |
| [T-029](T-029-entry-points.md) | Entry points and `Alt+Shift+N` | T-025 |
| [T-030](T-030-unsaved-guard.md) | Unsaved-changes guard | T-026 |

## Definition of done

- [ ] The page opens in its own tab from the popup, the panel and a shortcut
- [ ] Three panes: topics, list, editor — usable at 1024px and at 1920px
- [ ] Markdown can be written with a toolbar and previewed
- [ ] Several notes can be selected and moved, tagged, deleted or exported
- [ ] Notes can be sorted by date, verse order and topic, and filtered
- [ ] Editing here updates the panel live, and vice versa
- [ ] Closing with unsaved work warns

## Shared-module discipline

If you find yourself writing a feature that the panel *could* have but does not,
put it in `src/ui/app/` behind a density or capability flag rather than in
`notes.js`. The moment list or editor logic forks between the two hosts, the
"one application" property is gone and every later feature costs twice.
