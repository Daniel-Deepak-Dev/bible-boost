# MV3 constraints that shaped this design

Confidence: **verified** against the Chrome extension platform.

## Modules

| Context | ES modules? |
|---|---|
| Service worker | **Yes** — `"background": { "type": "module" }` |
| Extension pages (popup, panel, notes) | **Yes** — `<script type="module">` |
| Declared content scripts | **No** — classic scripts only |

This asymmetry is the reason the architecture looks the way it does. The service
worker is the only place that can `import` freely without a bundler, so it became
the single owner of the data layer. See `01-architecture.md`.

Content scripts share the **isolated world's** global object. Files listed in the
manifest's `js` array execute in order, so they can communicate through a
namespace:

```js
// first file
var BB = (typeof BB !== 'undefined') ? BB : {};
BB.dom = { parseUrl, columnEls, columns, firstSpans, verseLabel };
```

Order in the manifest array therefore matters: `bible-dom.js` must be listed
**before** anything that reads `BB.dom`.

A content script *can* use dynamic `import()` of an extension URL if the module
is in `web_accessible_resources`, but it is async and adds ordering complexity.
**We deliberately do not rely on it** — the content script sends raw drafts and
lets the worker do the validating.

## Service worker lifetime

The worker is **not persistent**. It is terminated after ~30 s idle and restarted
on the next event. Consequences:

- Never hold state in a module-level variable and assume it survives. The search
  index must be rebuildable on demand (and is — see T-043).
- Open IndexedDB lazily per invocation, or guard a cached handle against a closed
  connection.
- `chrome.storage` is the only reliable place for state between invocations.

## web_accessible_resources

An iframe loaded from a content script needs its page listed:

```jsonc
"web_accessible_resources": [
  { "resources": ["src/ui/panel.html", "src/ui/*"],
    "matches": ["https://www.bible.com/*"] }
]
```

Scope `matches` to bible.com — do not use `<all_urls>`, which lets any site probe
for the extension.

## Storage quotas

| Area | Limit |
|---|---|
| `storage.sync` | ~8 KB per item, ~100 KB total, ~120 writes/minute |
| `storage.local` | 10 MB, or unlimited with the `unlimitedStorage` permission |
| IndexedDB | disk-based; subject to eviction unless `unlimitedStorage` |

**Notes cannot live in `storage.sync`** — a single long note would blow the
per-item limit. This is why the split in `02-storage-model.md` exists.

`unlimitedStorage` does double duty: it lifts the `storage.local` cap **and**
exempts the origin's IndexedDB from quota eviction. Pair it with
`navigator.storage.persist()`.

## Side panel

```jsonc
"permissions": ["sidePanel"],
"side_panel": { "default_path": "src/ui/panel.html" }
```

Chrome 114+. The native panel **docks beside the viewport** — it cannot hover and
cannot be a percentage of the page. That is why the primary panel is an injected
iframe and the native panel is only an alternative host (T-052).

## Permissions we deliberately do NOT request

- **`tabs`** — the popup learns the active tab is bible.com by getting a reply
  from the content script, which runs nowhere else. Keep this trick.
- **`downloads`** — exports use `URL.createObjectURL` plus an anchor with
  `download`, which needs no permission from an extension page.
- **`clipboardWrite`** — `navigator.clipboard` works from a user gesture.
- **`host_permissions`** — the content-script match is sufficient.

Every added permission costs review friction and user trust. Justify each one.
