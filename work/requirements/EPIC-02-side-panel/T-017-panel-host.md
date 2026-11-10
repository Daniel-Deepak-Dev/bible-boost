# T-017 — Panel host: edge tab, lazy iframe, positioning

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Done |
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

**R9.** Set up the `postMessage` channel both ways, **checking `event.origin` and
`event.source` on both sides** and ignoring anything else. The two sides accept
different things:

- The **host** accepts the extension's origin, from the `contentWindow` of the frame
  it created. The origin alone is not enough, because bible.com can frame its own copy
  of `panel.html` (B-012).
- The **panel** accepts `https://www.bible.com`, from `window.parent`. That is the
  content script's origin, since it runs in bible.com's tab, and it is bible.com's own
  too. So the panel cannot tell the two apart, and nothing arriving this way may cause
  a write.

Prefix every message `bb:` so stray traffic is trivially ignored.

**R10.** At phone width the panel is full-width over the reader rather than 30%,
and squeezing is disabled — there is no room to squeeze into.

## Files

- `src/content/panel-host.js` — new
- `src/ui/panel.html`, `src/ui/panel.js` — minimal shell for now
- `manifest.json` — `web_accessible_resources`, the `js` array
- `content.css` — the tab and the panel box, which is where on-page styles live
- `content.js` — one line in `refresh()`, so that R8 follows client-side navigation
  through `schedule()` rather than through a polling loop of its own
- `src/shared/theme.css` — linked from `panel.html`, not edited

## Reference

- `work/understandings/extension/01-architecture.md` — rule 4, why an iframe
- `work/understandings/extension/03-messaging.md` — the host/panel message table
- `work/understandings/extension/04-observer-hazards.md` — why R5 is mandatory
- `work/understandings/bible-com/05-theme-and-page-chrome.md` — the bottom-chrome
  variables and their measured values
- `work/understandings/extension/05-mv3-constraints.md` —
  `web_accessible_resources`

## Acceptance

- [x] The tab appears on a reader page and not on the home page
- [x] It never overlaps the tab bar or the audio player, at 375px, 800px and
      1200px
- [x] The iframe does not exist in the DOM until the panel is first opened
- [x] Reopening reuses the existing iframe rather than reloading it
- [x] Open state survives a reload and client-side chapter navigation
- [x] `postMessage` round-trips between host and panel, and a message from an
      unexpected origin is ignored
- [x] With `DEBUG_SCHEDULE = true`, opening and closing ten times does not spam
      `schedule()`
- [x] The existing dock is still visible and clickable
- [x] At phone width the panel is full-width

## Notes

R2 matters more than it sounds. An iframe created on every bible.com page load
costs a document, a stylesheet and a script on pages where the user never opens
the panel.

T-014's **Save & open panel** button is disabled until `BB.panel.open` is a function.
Define that here and the button starts working, with no change to the popover.

R2 and R4 meet when a panel was left open: being open is what creates the iframe, so
that page load does create it. A restored open counts as the first open. A panel that
has never been opened still costs one button.

The tab stays visible over the open panel, even at phone width. Being open survives a
reload, so a frame that failed to load must not leave a full-width blank panel with no
way out. R3 lists only `panel.html`, narrower than the `src/ui/*` the understanding
file first suggested. The panel starts at `top: 0`, because bible.com publishes no
height for its header. The dock floats over the panel's bottom-right corner, so T-021
should leave room there.

**Verification, 2026-11-10.** Through a local proxy of the real page (see
`03-task-workflow.md`), running the working copy's files with `chrome` stubbed and the
panel on a second localhost port. The ticks above come from that:

- Geometry was read against bible.com's real bottom bar: top at 605px at 800x700 and
  628px at 375x700, with the panel ending 24px above each. The audio player was
  simulated by setting `--audio-bar-h` to 80px, and the panel moved up by 80px.
- Ten toggles made one load of the panel, kept the same `contentWindow`, and made no
  `schedule()` calls.
- Also exercised: the T-014 button opening the panel, alignment with the panel open
  (worst offset 0.44px on Exodus 13), and `Alt+A` and `Alt+S` through the keydown route.

**Real Chrome, 2026-11-10.** By hand in the user's Chrome, on live bible.com: the panel
opens with no `frame-src` error, stays open across a reload and a chapter change,
**Save & open panel** works, and the standing regression passes, **except** `Alt+P/A/S`.
The user reported those still dead in the same Chrome later that day, so they are
[B-006](../EPIC-08-maintenance/B-006-shortcuts-dead-in-chrome.md)'s and not ticked here.

The same day, Chrome 157 with the working copy loaded as an unpacked extension, on a
temporary headless profile (see `03-task-workflow.md`), read from inside the panel's own
frame:

- The iframe loads despite `frame-src`, and `panel.js` and `theme.css` load unlisted.
- Host to panel: `data-bb-open` follows each open and close, and the messages arrive with
  `origin: 'https://www.bible.com'` and `source === window.parent`.
- Panel to host: the × closes the panel. A message from the page's own window does not.
- Real `chrome.storage.local` held `panelOpen`, and a reload brought the panel back.

During the manual check, `dataset.bbOpen` read `undefined`. The panel's own frame read
`"true"` in the headless run, so the likely cause is the Console being on another context,
where `document` is bible.com's. That console was not seen, so this is an inference.

T-020's R6 said to ignore anything that is not the extension origin, which on the panel's
side would have dropped every message, so it and its acceptance item were corrected here.

**Review, 2026-11-10.** R9 above had the same mistake as T-020's R6 and was not corrected
with it, so it was rewritten after the review. Three things the review found are not in
this task's acceptance list:

- The host tested `event.origin` and never `event.source`. Fixed as
  [B-012](../EPIC-08-maintenance/B-012-panel-host-trusts-any-extension-frame.md).
- R4's pinned half is storage only. `pin` is handled, but nothing in `panel.js` sends it,
  and `announce` never tells the panel the restored `panelPinned`. T-018 has to do both.
- `send()` drops a message posted before the panel's `ready`, with no queue. That is safe
  for `state`, which `ready` sends again, and it would lose a `selection` draft posted
  straight after `open()`. Whichever task first sends one needs a queue.
