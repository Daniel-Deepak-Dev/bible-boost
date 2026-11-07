# T-002 — Module service worker and message router

| Field | Value |
|---|---|
| Epic | EPIC-00 Foundations |
| Status | Not started |
| Depends on | — |
| Blocks | T-003, T-005, and every data operation after it |
| Size | S |
| Risk | Low |

## Why

The service worker is the only context in this extension that can use ES modules
without a bundler. Making it the single owner of the data layer is what lets the
project stay dependency-free while still having one definition of a valid note,
one id generator and one validator.

The extension has **no background script at all** today, so this is new ground.

## Scope

**In:** the worker, its registration, a message router, and the shared helpers
that every later handler needs.

**Out:** any actual data handler — those arrive with T-005 and later epics.

## Requirements

**R1.** Add to the manifest:

```jsonc
"background": { "service_worker": "background.js", "type": "module" }
```

`"type": "module"` is required; without it `import` fails at load.

**R2.** `background.js` registers one `chrome.runtime.onMessage` listener that
dispatches on `msg.type` through a handler table, **not** a chain of `if`s:

```js
const HANDLERS = { 'notes/create': onCreate, /* ... */ };
```

**R3.** Every handler is `async` and returns a plain object. The router awaits
it, replies, and **returns `true`** so the channel stays open — unlike
`content.js`'s listener, which is deliberately synchronous.

**R4.** The router catches every throw and replies `{ ok: false, error: <string> }`.
A handler must never leave a caller hanging; an unanswered `sendMessage` is a
silent hang in the UI with no console trace.

**R5.** Unknown `msg.type` replies `{ ok: false, error: 'unknown message type' }`.

**R6.** Add `src/shared/schema.js` with `SCHEMA_VERSION`, the record defaults,
and `newId(prefix)`:

```js
const newId = (p) => p + '_' + Date.now().toString(36) + crypto.randomUUID().slice(0, 8);
```

Sortable by creation time, no dependency. **Ids are generated only here.**

**R7.** Add a `ping` handler returning `{ ok: true, schemaVersion }` so the
worker can be smoke-tested before anything else exists.

**R8.** Assume the worker is **not persistent**. It is terminated after ~30 s
idle. Hold no state in module scope that cannot be rebuilt.

## Files

- `background.js` — new
- `src/shared/schema.js` — new
- `manifest.json` — add the `background` key

## Reference

- `work/understandings/extension/01-architecture.md` — rules 1 and 2
- `work/understandings/extension/03-messaging.md` — the message catalogue and
  the existing three messages that must not break
- `work/understandings/extension/05-mv3-constraints.md` — module support, worker
  lifetime

## Acceptance

- [ ] The worker appears in `chrome://extensions` with no load error
- [ ] From the panel-less console of any extension page,
      `chrome.runtime.sendMessage({type:'ping'})` resolves to
      `{ ok: true, schemaVersion: 1 }`
- [ ] An unknown type resolves to `{ ok: false, error: ... }` rather than hanging
- [ ] A handler that throws resolves to `{ ok: false, error: ... }`
- [ ] The popup's existing `state` / `setParallel` / `go` messages still reach
      the **content script** and are unaffected
- [ ] After leaving the extension idle for a minute, `ping` still works (the
      worker restarts cleanly)

## Notes

The popup talks to the content script with `chrome.tabs.sendMessage`; the new
surfaces talk to the worker with `chrome.runtime.sendMessage`. These are
different channels and both listeners coexist. Do not consolidate them.
