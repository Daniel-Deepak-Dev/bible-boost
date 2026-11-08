# T-002 — Module service worker and message router

| Field | Value |
|---|---|
| Epic | EPIC-00 Foundations |
| Status | In progress |
| Depends on | — |
| Blocks | T-003, T-005, and every data operation after it |
| Size | S |
| Risk | Low |

## Why

The service worker is the only context in this extension that can use ES modules
without a bundler. Making it the single owner of the data layer is what lets the
project stay dependency-free while still having one definition of a valid note,
one id generator and one validator.

**`background.js` already exists** since B-006, holding only the
`chrome.commands` listener that relays the `Alt+P/A/S` shortcuts to the tab. The
manifest's `background` key (R1) is already in place. This task adds the router
**next to** that listener and leaves it alone: `onCommand` and `onMessage` are
separate entry points.

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

- `background.js` — exists (B-006); add the router beside the commands listener
- `src/shared/schema.js` — new
- `src/background/router.js` — new. `dispatch(handlers, msg)`, the R3–R5 contract
  as a pure function. It lives apart from `background.js` so `node --test` can
  prove the throw case: inside the live worker that needs a handler that throws,
  and a service worker cannot `import()` one from the console.
- `test/router.test.js`, `test/schema.test.js` — new, on the T-007 R1 convention
- `manifest.json` — the `background` key is already there (B-006); check it matches R1

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

**How the acceptance items are covered.** The unknown-type and throw items are
proven against `dispatch()` itself by `test/router.test.js` (`node --test`),
including the `toString` / `constructor` prototype-key case and throws of
non-`Error` values. No handler that throws ships in the worker, so the throw item
has no by-hand check. The other items need the unpacked extension loaded in
Chrome and are ticked only once someone has done that.

**Found along the way:** the documented test command `node --test test/` runs
nothing on Node 21+. It is now bare `node --test` everywhere, and the reason is
in `conventions/01-code-style.md`.
