# Messaging

Confidence: **design decision** for the new types; **verified** for the existing
three.

## Channels

| From | To | Mechanism |
|---|---|---|
| panel / notes page | service worker | `chrome.runtime.sendMessage` |
| content script | service worker | `chrome.runtime.sendMessage` |
| content script | panel iframe | `iframe.contentWindow.postMessage` |
| panel iframe | content script | `window.parent.postMessage` |
| worker | everyone | **no broadcast** — bump `notesRev`, see below |
| popup | content script | `chrome.tabs.sendMessage` (existing) |
| worker | content script | `chrome.tabs.sendMessage` — keyboard shortcuts only (B-006) |

## Existing messages — do not break these

Handled in `content.js`, synchronous, replying from the listener body:

| Message | Reply |
|---|---|
| `{type:'state'}` | `{parallel: boolean}` |
| `{type:'setParallel', on}` | `{ok: true}` |
| `{type:'go', url}` | `{ok:true}` or `{ok:false, error}` |
| `{type:'command', command}` | `{ok: boolean}`: false for an unknown name, or one that did not apply (Align on a single-version page) |

`command` comes from `background.js`, relaying a `chrome.commands` key press
(B-006). Its names, `toggle-parallel`, `toggle-align` and `toggle-separators`,
are the manifest's `commands` keys and the keys of `COMMANDS` in `content.js`.
All three lists must match. It is the one existing message the worker sends,
and it goes to a **tab**, so it does not break the "no broadcast" rule.

Two things to preserve:

1. **A reply to `state` is how the popup learns the tab is bible.com.** The
   content script runs nowhere else, so a failed reply means "not bible.com".
   This is why the extension needs no `tabs` permission.
2. **`go` is gated by `isOwnSiteUrl()`** — origin check, `https:` plus
   `www.bible.com`. Any **new** inbound message that navigates must reuse it.
   Checking hostname alone would accept `http:`; a substring test would accept
   `www.bible.com.evil.test`.

## The worker's router (T-002)

`background.js` holds a `HANDLERS` table keyed by `msg.type`, and
`dispatch(HANDLERS, msg)` in `src/background/router.js` turns each message into
exactly one reply. The rules belong to `dispatch`, not to each handler, and
`test/router.test.js` holds them:

| Situation | Reply |
|---|---|
| known type | whatever `handlers[type](msg)` resolves to, by convention `{ ok: true, ... }` |
| unknown or missing type, missing `msg` | `{ ok: false, error: 'unknown message type' }` |
| a name inherited from `Object.prototype` (`toString`, `constructor`, …) | the same unknown reply, **not** a call to that function |
| the handler throws or rejects, with anything | `{ ok: false, error: <string> }`, plus a `console.error` in the worker |

`error` is always a **string**, because `sendResponse` serializes the reply as
JSON and an `Error` object comes out of that as `{}`. Look for the stack in the
worker's own console (`chrome://extensions` → the "service worker" link), not in
the caller's.

A smoke test that needs nothing else built, from any extension page's console:

```js
await chrome.runtime.sendMessage({ type: 'ping' })   // { ok: true, schemaVersion: 1 }
```

### Two consequences of a router that answers everything

1. **`chrome.tabs.sendMessage` never reaches the worker.** It goes only to
   listeners inside that tab: its content scripts and, possibly, an extension
   page framed in it, such as the future panel iframe (not verified). That is why the popup's `state`,
   `setParallel` and `go` cannot be intercepted by the router, and why the
   router does not need to know about them.
2. **No extension page may use `chrome.runtime.onMessage` to receive from another
   extension page.** `runtime.sendMessage` goes to every extension context at
   once, the first reply wins, and the worker replies to *every* type, even if
   only with "unknown message type". A notes page listening for something the
   panel sent would lose that race at random. Pages coordinate through
   `chrome.storage.onChanged` (`notesRev`, below) instead.

## New message catalogue

Namespaced `area/verb`. Every worker handler returns a promise and the listener
returns `true` to keep the channel open.

```
ping              {}                         -> { ok, schemaVersion }

notes/create      { draft }                  -> { ok, note }
notes/update      { id, patch }              -> { ok, note }
notes/get         { id }                     -> { ok, note }
notes/list        { filter, sort, page }     -> { ok, notes, total }
notes/trash       { ids }                    -> { ok, undoToken }
notes/restore     { ids }                    -> { ok }
notes/purge       { ids }                    -> { ok }

topics/list       {}                         -> { ok, topics }
topics/create     { name, color, parentId }  -> { ok, topic }
topics/update     { id, patch }              -> { ok, topic }
topics/delete     { id, strategy }           -> { ok }   // 'reassign' | 'trash'
topics/counts     {}                         -> { ok, counts }

tags/list         {}                         -> { ok, tags }
tags/rename       { from, to }               -> { ok, affected }
tags/merge        { from[], into }           -> { ok, affected }
tags/delete       { name }                   -> { ok, affected }

search/query      { q, filters, limit }      -> { ok, hits }

io/export         { format, scope }          -> { ok, filename, mime, data }
io/importPreview  { format, data }           -> { ok, diff }
io/import         { format, data, strategy } -> { ok, applied }
```

## Change propagation — `notesRev`

The worker does **not** enumerate tabs. After any write it bumps a counter in
`chrome.storage.local`:

```js
{ notesRev: 42, notesRevIds: ['n_abc'], notesRevKind: 'update' }
```

Every surface listens with `chrome.storage.onChanged`. This works in content
scripts and extension pages alike, needs no `tabs` permission, and lets a
listener patch one row instead of refetching everything.

It is the same pattern `content.js` already uses for settings — filter on
`area === 'local'`, as the existing listener filters on `'sync'`.

**All writes go through one `bumpRev()` in `repo.js`.** A write that forgets to
bump leaves other surfaces stale, which looks like a CRUD bug and is very hard to
trace.

## postMessage between content script and panel iframe

The iframe's origin is `chrome-extension://<id>`. **Check `event.origin` on both
sides** and ignore anything else — bible.com can post into the frame too.

| Direction | Message | Purpose |
|---|---|---|
| host → panel | `{bb:'theme', theme:'dark'}` | relay `html.dark` (the page observer cannot see it) |
| host → panel | `{bb:'context', ref:'EXO.13', versions:[...]}` | what chapter is on screen |
| host → panel | `{bb:'selection', draft}` | user hit save with a verse selected |
| panel → host | `{bb:'resize', width}` | user dragged the edge |
| panel → host | `{bb:'pin', pinned}` | squeeze vs overlay |
| panel → host | `{bb:'close'}` | collapse to the edge tab |

Prefix every message with `bb:` so stray traffic is trivially ignored.
