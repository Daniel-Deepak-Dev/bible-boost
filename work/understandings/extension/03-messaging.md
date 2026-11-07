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

## Existing messages — do not break these

Handled in `content.js`, synchronous, replying from the listener body:

| Message | Reply |
|---|---|
| `{type:'state'}` | `{parallel: boolean}` |
| `{type:'setParallel', on}` | `{ok: true}` |
| `{type:'go', url}` | `{ok:true}` or `{ok:false, error}` |

Two things to preserve:

1. **A reply to `state` is how the popup learns the tab is bible.com.** The
   content script runs nowhere else, so a failed reply means "not bible.com".
   This is why the extension needs no `tabs` permission.
2. **`go` is gated by `isOwnSiteUrl()`** — origin check, `https:` plus
   `www.bible.com`. Any **new** inbound message that navigates must reuse it.
   Checking hostname alone would accept `http:`; a substring test would accept
   `www.bible.com.evil.test`.

## New message catalogue

Namespaced `area/verb`. Every worker handler returns a promise and the listener
returns `true` to keep the channel open.

```
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
