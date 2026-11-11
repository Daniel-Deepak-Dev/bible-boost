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
   content script runs nowhere else, so a reply proves it, which is why the
   extension needs no `tabs` permission. **Silence does not prove the opposite**
   (B-007): a bible.com tab also says nothing while it is still loading, or if
   it was already open when the extension was installed or reloaded. So the
   popup keeps asking for 10 s, and its note says "open or reload".
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
| unknown, missing or non-string type, missing `msg` | `{ ok: false, error: 'unknown message type' }` |
| a name inherited from `Object.prototype` (`toString`, `constructor`, …) | the same unknown reply, **not** a call to that function |
| the handler throws or rejects, with anything | `{ ok: false, error: <string> }`, plus a `console.error` in the worker |

`error` is always a **string**, because `sendResponse` serializes the reply as
JSON and an `Error` object comes out of that as `{}`. Look for the stack in the
worker's own console (`chrome://extensions` → the "service worker" link). Do not
count on seeing it in the caller's, although it can turn up there: T-005's acceptance
output had the worker's `console.error` line among the pasted script's own. So a red
`handler failed` during a check is not by itself a failure. Read the reply.

Two traps in that table, both held by a test:

- **`Object.hasOwn` coerces its key.** A non-string `type` is refused before the
  lookup, because `{ type: ['ping'] }` would otherwise pass as `'ping'` and run
  that handler.
- **Building the `error` text can throw.** `String()` throws on a value with no
  way to become a primitive, such as `Object.create(null)`. Unguarded, that
  happens inside `dispatch`'s own `catch`, the promise rejects, `reply` never
  runs and the caller hangs. Such a value, or a bare `throw ''`, replies
  `error: 'handler failed'`.

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

### Calling the worker from a content script

`ask()` in `src/content/save-popover.js` was the first (T-014). Whatever goes wrong
has to come back as `{ ok: false, error }`, because the note being written is still on
the screen and has to stay there. Beyond the router's own `ok: false`, two failures
exist that the router cannot report, both **from Chrome's documentation and not
provoked here**:

- **No reply.** `sendMessage` resolves to `undefined` if the worker dies part way.
- **An orphaned script.** After the extension is reloaded, a content script already
  in a tab throws `Extension context invalidated` from `sendMessage`, and a page
  reload is the only cure. Tell the user to copy what they typed first.

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

### What the notes, topic and tag payloads hold (T-005)

Everything not listed is ignored, so a caller cannot set `id`, timestamps,
`deletedAt` or `verseKeys`.

| Field | Accepts |
|---|---|
| `draft` | `source` (required: `menu`, `panel`, `page` or `import`), plus any of the `patch` fields; needs a verse or a non-blank body |
| `patch` | `title`, `body`, `topicId`, `tags`, `verses`, `color`, `pinned`; only what is sent changes |
| `filter` | `trashed` (literal `true`: Trash only), `topicId` (`null` is Uncategorized), `tag`, `verseKey`, `chapter` (`EXO.13`), `from` and `to` (ms, on `updatedAt`) |
| `sort` | `{ by, dir }`: `updatedAt`, `createdAt`, or `deletedAt` in Trash; `asc` or `desc`. Newest first by default |
| `page` | `{ offset, limit }`: limit defaults to 100, caps at 500, and `0` returns only `total` |

Replies beyond the catalogue's minimum: `notes/restore` adds `restored` and
`uncategorized` (ids whose topic has since been deleted), `notes/purge` adds `purged`,
and `topics/delete` adds `affected`. `notes/get` for a missing id is
`{ ok: true, note: null }`. `counts` is `{ topics: { id: n }, uncategorized, trash }`.

`undoToken` from `notes/trash` is the array of ids that call moved, so
`notes/restore { ids: undoToken }` is its undo. It is plain data on purpose: Chrome
may have restarted the worker before the user clicks Undo.

`tags/rename` onto a different existing tag is an error, so the UI can offer a merge
(T-033 R3). `affected` counts every note rewritten, including those in Trash.

## Change propagation — `notesRev`

The worker does **not** enumerate tabs. After any write it bumps a counter in
`chrome.storage.local`:

```js
{ notesRev: 42, notesRevIds: ['n_abc'], notesRevKind: 'update' }
```

`notesRevKind` is `create`, `update`, `trash`, `restore`, `purge`, `topics` or
`tags`. `notesRevIds` are always **note** ids, so it is empty when only a topic or a
tag row changed. For those two kinds a listener should refetch rather than patch.

**Watch `changes.notesRev`.** The bumps are queued so it rises by exactly one per
write. Without the queue, two overlapping writes both read 42 and both store 43, and
the second one changes only `notesRevIds`.

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
sides** and ignore anything else. The two checks are not the same check:

| Receiver | Accepts | What that keeps out |
|---|---|---|
| host (`panel-host.js`) | the extension's origin, and `event.source === frame.contentWindow` | everything bible.com runs, and a second copy of the panel that the page framed itself |
| panel (`panel.js`) | `https://www.bible.com`, and `event.source === window.parent` | other sites, and frames embedded in the page |

**The origin alone is not a barrier on the host's side.** `panel.html` is
web-accessible to `https://www.bible.com/*`, which is what lets the host frame it, and
it lets the page frame its own copy just the same. That copy runs the real `panel.js`,
so it posts `ready` as it loads and `close` when its × is clicked, both with the
extension's origin. Until B-012 the host tested the origin only, and its comment said
nothing bible.com runs could pass. Any page listed in a resource's `matches` can frame
that resource, so "has our origin" never means "is the frame we made".

**The panel cannot tell bible.com's scripts from the content script.** `panel-host.js`
runs inside bible.com's tab, so its messages carry bible.com's origin, and so do the
page's own. Two consequences:

- **Nothing arriving in the panel by `postMessage` may cause a write.** Treat it as
  what the page says, fit for display only.
- **Everything the panel posts up is readable by bible.com**, because a message to the
  top window reaches every listener on it. No note text goes on this channel.

Confidence: **verified** on 2026-11-10 in Chrome 157 with the real extension on live
bible.com (T-017). Messages from `panel-host.js` arrived with `origin:
'https://www.bible.com'` and `event.source === window.parent`. A script in the page's
main world was accepted just the same, and a message the panel posted to itself was
refused. A `data:` frame and a same-origin `srcdoc` frame were refused through a local
proxy of the real page, where the panel was on a second port.

| Direction | Message | Purpose |
|---|---|---|
| panel → host | `{bb:'ready'}` | the panel's listener exists, so the host can start sending |
| host → panel | `{bb:'state', open, pinned, canPin}` | sent on `ready`, on every open, close or pin, and when the window crosses 768px. `canPin` is false below 768px, where the panel is full-width and nothing is squeezed. The host works it out because a media query inside the frame measures the frame (T-018) |
| host → panel | `{bb:'theme', theme:'dark'}` | relay `html.dark` (the page observer cannot see it) |
| host → panel | `{bb:'context', ref:'EXO.13', versions:[...]}` | what chapter is on screen |
| host → panel | `{bb:'selection', draft}` | user hit save with a verse selected |
| panel → host | `{bb:'resize', width}` | user dragged the edge |
| panel → host | `{bb:'pin', pinned}` | squeeze vs overlay, from the pin button (T-018). The host stores it, which is safe only because of the `source` check. The button changes only when the host's `state` comes back |
| panel → host | `{bb:'close'}` | collapse to the edge tab |

Prefix every message with `bb:` so stray traffic is trivially ignored.
