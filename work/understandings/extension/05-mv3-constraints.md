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
// src/content/bible-dom.js — the first file
var BB = (typeof BB !== 'undefined') ? BB : {};

(() => {
  // ... the readers ...
  BB.dom = { REF_RE, VID_RE, LANG_RE, parseUrl, columnEls, columns, langOf, firstSpans, verseLabel };
})();
```

Order in the manifest array therefore matters: `bible-dom.js` must be listed
**before** anything that reads `BB.dom`.

### One global scope, so only `BB` may escape

Classic scripts share **one global lexical scope** across files — not just the
global object. That has two consequences, both verified with `node:vm` (which
behaves the same way) while doing T-001:

- **A top-level `const` or `let` cannot be declared twice.** If one content
  script says `const REF_RE = …` at top level and a later one says it again, the
  later file fails with `SyntaxError: Identifier 'REF_RE' has already been
  declared` and **none of it runs**. So every content-script file wraps its body
  in an IIFE and lets exactly one name out: `BB`.
- **`BB` itself must be `var`**, which, unlike `const`, may be re-declared
  in another file. With the `typeof` guard, whichever file runs first creates
  `BB` and later ones add to it, so file order cannot break the namespace.

`content.js` takes what it needs once, at the top of its own IIFE:

```js
const { parseUrl, columnEls, columns, firstSpans, verseLabel } = BB.dom;
```

That keeps its alignment code calling the readers by their own names, and if
`bible-dom.js` failed to load it throws a `ReferenceError` at load instead of
half-working until the first call.

### Calling `BB.dom` from DevTools

Content-script globals live in the **isolated world**, so typing `BB` in the
console's default `top` context gives `ReferenceError: BB is not defined`.
Switch the console's context dropdown (top-left of the Console tab) from `top`
to the BibleBoost entry first. Reload the extension *and* the tab after any
change: Chrome does not re-inject content scripts into a tab that is already open.

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

### What a module worker may not do

Confidence: **from Chrome's documentation and the HTML spec, not verified here**.
Each of these fails in a way that looks like something else, which is why they
are written down before T-003 needs them.

T-002's acceptance run on 2026-11-09 confirmed the working side of two of them,
in a real Chrome. `ping` from an extension page got its reply through
`dispatch(...).then(reply); return true;`. And after the worker had gone inactive,
the next `ping` woke it and was answered, so a listener registered at the top
level does receive the message that started the worker. The failures themselves
were not provoked.

- **Register every listener synchronously, at the top level of
  `background.js`.** When an event wakes a stopped worker, Chrome delivers it to
  the listeners that exist once the script has finished its first run. A
  listener added after an `await`, such as after opening the database, misses the
  very message that started the worker, and the caller hangs.
- **No top-level `await`, and no dynamic `import()`.** A service-worker module
  graph has to evaluate synchronously, and `import()` is refused in a worker
  scope. So T-003 cannot `await openDb()` at load: open it lazily, inside a
  handler, as the "Service worker lifetime" bullets above already say. It also
  means you cannot `import()` a module from the worker's DevTools console to try
  it out, which is why `dispatch()` lives in `src/background/router.js`, where
  `node --test` can reach it.
- **A static `import` of a missing or misspelled file fails the whole worker.**
  The registration error shows on `chrome://extensions`, and neither listener
  runs, so the keyboard shortcuts go silent as well.
- **`onMessage` listeners return `true`; they are not `async`.** Returning
  literally `true` is the documented way to keep the reply channel open. An
  `async` listener returns a Promise, and on a Chrome that does not take a
  returned Promise as the reply, the caller's `sendMessage` resolves to
  `undefined`. `background.js` therefore does `dispatch(...).then(reply); return
  true;`.

## Keyboard shortcuts: `chrome.commands`

Since B-006, `Alt+P` / `Alt+A` / `Alt+S` are declared under `commands` in the
manifest. `background.js` relays them to the tab as `{type:'command', command}`.
The in-page keydown listener in `content.js` stays as a fallback. Why: in the
user's Chrome the page listener never fired, even though bible.com does not
swallow the keys, and the cause was never found. See B-006.

**It did not fix that case.** The command route stayed silent too, so the cause
lies outside both routes. B-006 is open with the next checks. Do not assume
`chrome.commands` is a cure for "the shortcut does nothing"; check
`chrome://extensions/shortcuts` first.

Confidence: **from Chrome's documentation, not yet verified here**, except where
B-006's acceptance ticks it.

- **At most four suggested keys per extension.** B-006 uses three, and T-029's
  `Alt+Shift+N` is the fourth. Any further shortcut has to live in the keydown
  listener, or be declared with no `suggested_key` so the user binds it by hand.
- A suggested key needs `Ctrl` or `Alt`, with `Shift` optional.
- **A key Chrome cannot assign is silently left blank.** That happens when
  another extension already holds it. The command still exists and can be bound
  at `chrome://extensions/shortcuts`. That page is the first thing to check
  when "the shortcut does nothing".
- `onCommand` gets `(command, tab)`. `chrome.tabs.sendMessage(tab.id, …)` needs
  no `tabs` permission, so the no-`tabs` rule below still holds.
- **Content scripts cannot call `chrome.commands`**, so they cannot read the
  user's actual bindings. The dock tooltips name the default keys.
- Chrome handles a bound key itself and does not pass it on to the page, so
  the command and the keydown fallback should never both fire for one press.
  B-006 checks that Alt+A toggles once.

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
