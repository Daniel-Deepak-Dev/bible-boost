# EPIC-02 — Side panel

**Goal:** a collapsible notes panel on bible.com, in the spirit of Salesforce
Inspector Reloaded — a floating tab at the right edge that opens into a working
panel, and gets out of the way when it is not wanted.

Two decisions shape this epic:

**It is an iframe.** That gives total CSS isolation from bible.com, which a
light-DOM dock does not, and it keeps the panel's own DOM churn invisible to the
page observer. The cost is that it cannot read the page — it talks to
`panel-host.js` by `postMessage`.

**Pinned squeezes, peek overlays.** A 30% overlay would sit on top of the second
version in parallel mode — exactly the text the user is writing about. Pinned,
the reader shrinks and bible.com reflows; unpinned, it overlays like Inspector
Reloaded. The existing `ResizeObserver` on the columns re-runs alignment for
free.

## Tasks

| Id | Title | Depends on |
|---|---|---|
| [T-017](T-017-panel-host.md) | Panel host: edge tab, lazy iframe, positioning | T-004, T-006 |
| [T-018](T-018-pin-and-squeeze.md) | Pinned squeeze vs unpinned overlay | T-017 |
| [T-019](T-019-resize.md) | Drag-to-resize with persisted width | T-017 |
| [T-020](T-020-theme-relay.md) | Theme relay into the iframe | T-017 |
| [T-021](T-021-compact-list.md) | Compact note list | T-005, T-017 |
| [T-022](T-022-panel-crud.md) | Inline create, edit and delete-with-undo | T-021 |
| [T-023](T-023-chapter-context.md) | Default to the chapter on screen | T-021 |
| [T-024](T-024-panel-shortcut.md) | `Alt+B` toggle | T-017 |

## Definition of done

- [ ] A floating tab sits at the right edge of every bible.com reader page
- [x] Opening it pinned squeezes the reader; both parallel columns stay fully
      visible and aligned
- [x] Unpinned, it overlays with a shadow
- [ ] Width is draggable and survives a reload
- [ ] It follows bible.com's light/dark theme
- [ ] Notes can be created, edited and deleted from it
- [ ] It defaults to the chapter on screen
- [ ] `Alt+B` toggles it
- [ ] With `DEBUG_SCHEDULE = true`, typing in the panel does not re-run
      `align()`

## The compactness requirement

The user's words: *"side panel should be compact as possible, dont make it look
overloaded."* Treat that as a hard constraint, not a preference.

- A list row is a reference, a two-line preview and a topic dot. Nothing else.
- No toolbars at rest. Actions appear on hover, focus, or in an overflow menu.
- Anything that needs more room belongs in the full page (EPIC-03), and the panel
  should offer a one-click way to get there.
