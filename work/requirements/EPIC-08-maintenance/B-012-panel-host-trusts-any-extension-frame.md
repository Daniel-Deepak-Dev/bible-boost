# B-012 — The panel host accepts a message from any frame with the extension's origin

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | In progress |
| Type | Found by the review of T-017 |
| Blocks release | No |
| Depends on | T-017 |
| Size | S |
| Risk | Low |

## The problem

`onMessage` in `src/content/panel-host.js` tested `e.origin` against the extension's
origin and nothing else. Its comment, and the table in `03-messaging.md`, said that
nothing bible.com runs can pass that test, because only extension pages have that
origin.

That is not true. `panel.html` is listed in `web_accessible_resources` for
`https://www.bible.com/*`, which is what lets the host frame it at all, and it lets the
page frame it just the same. A page script can add its own
`<iframe src="chrome-extension://<id>/src/ui/panel.html">`. That frame runs the real
`panel.js`, which posts `{bb:'ready'}` to `window.parent` as it loads and `{bb:'close'}`
when its × is clicked, and both arrive at the host carrying the extension's origin.

Today the effect is small. A stray `ready` sets `frameReady` early, so one `state`
message is posted to a frame that is not listening yet, and the real frame's own
`ready` sends it again. A stray `close` needs a click inside the stranger's frame.

It stops being small when the panel can write. `pin` already persists `panelPinned`,
and T-019's `resize` will persist a width. A transparent frame laid over the page could
then turn a click the user meant for bible.com into a stored setting.

## Scope

**In:** the host's check of who sent a message, and the three places that describe it.

**Out:** the panel's own check, which already tests `event.source === window.parent`.
A queue for messages sent before `ready` belongs to whichever task first sends one that
is not repeated on `ready`; no task file names it yet, and T-017's Notes record the gap.
Sending the pinned state to the panel is T-018's.

## Requirements

**R1.** `onMessage` ignores a message unless `e.source` is the `contentWindow` of the
frame the host created, as well as `e.origin` being the extension's.

**R2.** Read `frame.contentWindow` at the moment of the message and do not cache it.
`render()` puts a removed box back, which reloads the frame, and the window is a new
one after that.

**R3.** The comment above `onMessage`, the table in
`work/understandings/extension/03-messaging.md` and T-017's R9 say what the check
really is.

## Files

- `src/content/panel-host.js` — `onMessage`
- `work/understandings/extension/03-messaging.md`
- `work/requirements/EPIC-02-side-panel/T-017-panel-host.md` — R9

## Reference

- `work/understandings/extension/03-messaging.md` — "postMessage between content script
  and panel iframe"
- `work/understandings/extension/05-mv3-constraints.md` — `web_accessible_resources`

## Acceptance

- [x] A second `panel.html` frame added by the page does not set `frameReady`, and its ×
      does not close the panel
- [x] The real panel's × still closes the panel
- [x] After the box is removed and `render()` puts it back, the reloaded panel's `ready`
      is still accepted
- [ ] The standing regression check passes

## Notes

**Still open: real Chrome.** The three ticks are from a stand-in, described below. It
runs the working copy's `panel-host.js` and `panel.js`, and it proves the host's logic
and nothing about `chrome-extension:` origins or the isolated world. The standing
regression check has not been run since the change, so Status stays In progress until
it has, on live bible.com with the extension loaded.

**Stand-in, 2026-11-10.** A Node server in the scratchpad served a reader-shaped page on
one localhost port with `chrome` stubbed, and the panel on a second port so that the
frame was cross-origin. The panel's HTML was held back three seconds, so the page could
add its own copy of the panel while the real one was still loading. The same run was
repeated with the old one-line check swapped back in as the file was served:

| Step | Working copy | Old check |
|---|---|---|
| a page-made frame posts `ready` while the real frame is loading | `frameReady` stays false | `frameReady` true |
| the real frame's `ready` arrives | true | true |
| a page-made frame's × is clicked | panel stays open | panel closes |
| the real panel's × is clicked | panel closes | not reached |
| the box is removed and `render()` puts it back | false, then true once the frame reloads | not run |

The old column is what shows the check can fail. Without it, three passing rows would
say only that nothing went wrong.
