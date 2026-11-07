# T-050 — Native chrome.sidePanel as a third host

| Field | Value |
|---|---|
| Epic | EPIC-07 Polish and release |
| Status | Not started |
| Depends on | T-017, T-020 |
| Blocks | T-051 |
| Size | S |
| Risk | Low |

## Why

The injected overlay was chosen as the primary panel because it can hover, can be
a percentage of the page, and can collapse to a floating tab — none of which
Chrome's native side panel can do.

But the native panel has real advantages the overlay cannot match: it never
covers page content, it survives navigation without re-injection, and it is
immune to anything bible.com does to its own layout. Some users will prefer it.

Because the panel is already a standalone extension page, this is mostly
manifest and wiring — which is the payoff for the iframe decision in T-017.

## Scope

**In:** registering and opening the same page as a native side panel.

**Out:** the choice between hosts (T-051).

## Requirements

**R1.** Manifest:

```jsonc
"permissions": ["sidePanel"],
"side_panel": { "default_path": "src/ui/panel.html" }
```

Chrome 114+.

**R2. The same page, unchanged.** `panel.html` must work in both hosts with no
forked code path. Where behaviour must differ, detect the host at runtime — the
native panel has no parent frame — and branch on a capability, not on a copy.

**R3.** Things the native host cannot do, which must degrade rather than break:

| Overlay-only | Native behaviour |
|---|---|
| pin / squeeze | hidden; Chrome owns the layout |
| drag-to-resize | hidden; Chrome owns the width |
| `postMessage` to the host | unavailable |

**R4. Chapter context and theme must still reach it.** With no parent frame,
T-020's relay and T-023's context message do not apply. Use `chrome.storage.local`
as the channel: `panel-host.js` already knows the page state, so have it publish
`currentRef` and `pageTheme` there, and the native panel subscribes via
`chrome.storage.onChanged`.

This also tidies the overlay path, which can read the same keys.

**R5.** Opening: `chrome.sidePanel.open()` from a user gesture — a popup button
or a `chrome.commands` shortcut. It cannot be opened programmatically without
one.

**R6.** Scope it to bible.com tabs with `chrome.sidePanel.setOptions({ tabId })`,
or make it clear in the panel when there is no reader page — a notes panel beside
an unrelated site should still list notes, just without chapter context.

**R7.** **Only one native side panel per window.** If the user also has the
overlay open, both show the same data and both stay in sync through `notesRev`.
That is acceptable and should be verified, not prevented.

**R8.** The native panel follows the **browser** theme, not bible.com's — it is
outside the page. Fall back to `prefers-color-scheme` there, per T-020's R5.

## Files

- `manifest.json` — `sidePanel` permission and `side_panel` key
- `src/ui/panel.js` — host detection, capability branches
- `src/content/panel-host.js` — publish `currentRef` and `pageTheme`
- `background.js` — the open command
- `popup.js` — an open button

## Reference

- `work/understandings/extension/05-mv3-constraints.md` — side panel limits and
  why the overlay is primary
- `work/understandings/extension/03-messaging.md` — the host/panel messages that
  do not exist here
- `work/understandings/extension/01-architecture.md` — rule 3

## Acceptance

- [ ] The native side panel opens from the popup and lists notes
- [ ] It is the same `panel.html`, with **no** forked copy
- [ ] Pin and resize controls are hidden there, not broken
- [ ] Chapter context follows bible.com navigation via `storage.local`
- [ ] It renders correctly in browser light and dark themes
- [ ] Overlay and native open simultaneously stay in sync
- [ ] Opening it beside a non-bible.com tab lists notes without chapter context
- [ ] CRUD works identically in both hosts

## Notes

R4 is the real work. Treating `storage.local` as a small published page-state
channel is simpler than two messaging mechanisms, and it benefits the overlay
too.
