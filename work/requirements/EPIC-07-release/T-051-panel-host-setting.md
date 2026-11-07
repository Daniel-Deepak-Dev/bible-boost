# T-051 — Setting: overlay / native / both

| Field | Value |
|---|---|
| Epic | EPIC-07 Polish and release |
| Status | Not started |
| Depends on | T-050 |
| Blocks | — |
| Size | XS |
| Risk | Low |

## Why

Two panel hosts exist and neither is right for everyone. Someone on a wide
monitor reading in parallel wants the overlay collapsed to a tab; someone on a
laptop who never wants text covered wants the native panel. Making it a setting
is cheaper than guessing, and the plumbing already exists.

## Scope

**In:** one setting, and what the edge tab and shortcut do under each value.

**Out:** the hosts themselves (T-017, T-050).

## Requirements

**R1.** A `panelHost` setting with three values:

| Value | Effect |
|---|---|
| `overlay` (default) | the injected iframe; the edge tab is shown |
| `native` | Chrome's side panel; **no edge tab injected** |
| `both` | the edge tab is shown and the native panel is also available |

**R2.** Default `overlay` — it is the behaviour the feature was designed around
and matches the stated requirement.

**R3.** Store it in `chrome.storage.sync`, not `local`. It is a small preference
that should follow the user between machines, which is exactly what the existing
settings use `sync` for. Add it to the `DEFAULTS` object so
`store.get(DEFAULTS, cb)` backfills it for existing installs for free — that is
the project's established migration mechanism.

**R4.** Expose it in the toolbar popup alongside the existing switches, in the
same visual language. Do not build a separate options page for one setting.

**R5. `Alt+B` respects the setting:** `overlay` toggles the iframe, `native`
opens the side panel, `both` toggles the overlay (the native one has its own
Chrome affordance).

`chrome.sidePanel.open()` needs a user gesture — a keyboard shortcut handled in
the content script may not count as one from the worker's perspective.
**Verify this and document the result**, in the understanding file if it turns
out to be a platform constraint worth recording.

**R6.** Changing the setting takes effect without a reload: switching to `native`
removes the injected tab immediately, switching back re-adds it.

**R7.** On a Chrome older than 114, `chrome.sidePanel` is absent. Hide the
native options entirely rather than offering a setting that does nothing.

## Files

- `popup.html`, `popup.js` — the control
- `content.js` — `DEFAULTS`, and react to the change
- `src/content/panel-host.js` — show or hide the edge tab
- `background.js` — open the native panel

## Reference

- `work/understandings/extension/02-storage-model.md` — `storage.sync` holds the
  existing settings; the `DEFAULTS` backfill is the migration mechanism
- `work/understandings/extension/05-mv3-constraints.md` — side panel availability
- `work/understandings/conventions/02-css-and-theming.md` — popup styling

## Acceptance

- [ ] The setting appears in the popup with the existing switches
- [ ] `overlay` shows the edge tab and no native panel
- [ ] `native` injects **no** edge tab, and the popup opens the side panel
- [ ] `both` offers both, and they stay in sync
- [ ] Changing it takes effect with no reload
- [ ] It persists and syncs
- [ ] An existing install gets the default backfilled without losing other
      settings
- [ ] `Alt+B` does the right thing under each value, and the gesture question in
      R5 is resolved and documented
- [ ] On Chrome < 114 the native options are hidden

## Notes

R3 is the small correct choice: this belongs with `align` and `showSwitch` in
`sync`, not with panel width in `local`. The distinction is preference versus
per-device UI state.
