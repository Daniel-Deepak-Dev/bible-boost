# T-017 — Panel host: edge tab, lazy iframe, positioning

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Not started |
| Depends on | T-004, T-006 |
| Blocks | T-018, T-019, T-020, T-021, T-024 |
| Size | M |
| Risk | Medium |

## Why

This is the shell everything else in the epic hangs off. It decides what is
always present on the page (as little as possible), what is created on demand,
and how the panel avoids colliding with bible.com's own chrome.

Salesforce Inspector Reloaded's key trick is that the always-present cost is one
small button. On a SPA that re-renders constantly, that difference is the whole
performance story.

## Scope

**In:** the edge tab, creating and destroying the iframe, open/closed state,
vertical positioning.

**Out:** squeeze vs overlay (T-018), resizing (T-019), theme (T-020), and
anything rendered *inside* the panel (T-021+).

## Requirements

**R1.** `src/content/panel-host.js` renders a slim tab fixed to the right edge,
vertically centred, in the `#bb-dock` pill visual language. It is the only thing
present when the panel is closed.

**R2. Create the iframe lazily** — on first open, never on page load. Once
created, keep it and toggle visibility; do not destroy and rebuild on every
toggle.

**R3.** The iframe loads `src/ui/panel.html`, which must be listed in
`web_accessible_resources` scoped to `https://www.bible.com/*`. Do **not** use
`<all_urls>` — that lets any site probe for the extension.

**R4.** Open/closed and pinned state persist in `chrome.storage.local` and
restore on the next page load.

**R5. Everything carries `data-bb-own`** — the tab, the host wrapper, the iframe.
Mandatory, or the T-004 guard cannot suppress the churn.

**R6.** Respect bible.com's bottom chrome using its own published variables, as
`content.css` already does:

```css
bottom: calc(24px + var(--tabbar-h, 0px) + var(--audio-bar-h, 0px));
```

`--tabbar-h` measures 72px at phone widths, 95px at 800px and 0px by 1010px. The
panel must never sit under the tab bar or the audio player.

**R7.** `z-index` below the existing dock's `2147483000` so the two never fight,
and the dock stays reachable.

**R8.** Only render on reader pages — where `BB.dom.parseUrl()` is non-null. No
tab on the home page or the Verse of the Day page.

**R9.** Set up the `postMessage` channel both ways, **checking `event.origin` on
both sides** and ignoring anything else. bible.com can post into the frame too.
Prefix every message `bb:` so stray traffic is trivially ignored.

**R10.** At phone width the panel is full-width over the reader rather than 30%,
and squeezing is disabled — there is no room to squeeze into.

## Files

- `src/content/panel-host.js` — new
- `src/ui/panel.html`, `src/ui/panel.js` — minimal shell for now
- `manifest.json` — `web_accessible_resources`, the `js` array
- `src/shared/theme.css`

## Reference

- `work/understandings/extension/01-architecture.md` — rule 4, why an iframe
- `work/understandings/extension/03-messaging.md` — the host/panel message table
- `work/understandings/extension/04-observer-hazards.md` — why R5 is mandatory
- `work/understandings/bible-com/05-theme-and-page-chrome.md` — the bottom-chrome
  variables and their measured values
- `work/understandings/extension/05-mv3-constraints.md` —
  `web_accessible_resources`

## Acceptance

- [ ] The tab appears on a reader page and not on the home page
- [ ] It never overlaps the tab bar or the audio player, at 375px, 800px and
      1200px
- [ ] The iframe does not exist in the DOM until the panel is first opened
- [ ] Reopening reuses the existing iframe rather than reloading it
- [ ] Open state survives a reload and client-side chapter navigation
- [ ] `postMessage` round-trips between host and panel, and a message from an
      unexpected origin is ignored
- [ ] With `DEBUG_SCHEDULE = true`, opening and closing ten times does not spam
      `schedule()`
- [ ] The existing dock is still visible and clickable
- [ ] At phone width the panel is full-width

## Notes

R2 matters more than it sounds. An iframe created on every bible.com page load
costs a document, a stylesheet and a script on pages where the user never opens
the panel.
