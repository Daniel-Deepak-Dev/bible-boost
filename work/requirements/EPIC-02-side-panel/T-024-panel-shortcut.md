# T-024 — Alt+B toggle

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Not started |
| Depends on | T-017 |
| Blocks | — |
| Size | XS |
| Risk | Low |

## Why

The extension already has a keyboard identity — `Alt+P`, `Alt+A`, `Alt+S` — and
the panel is the thing a user will toggle most often. Not giving it a shortcut
would be the odd one out.

## Scope

**In:** one shortcut, registered in the existing handler, documented.

**Out:** `Alt+N` (T-015), and the global `Alt+Shift+N` for the full page (T-029),
which uses `chrome.commands` because it must work off bible.com.

## Requirements

**R1.** `Alt+B` toggles the panel open and closed. B for Boost; `Alt+N` is
already Note and `Alt+P/A/S` are taken.

**R2.** Register it in the **existing** keydown listener in `content.js`,
alongside the other three. Do not add a second document-level listener — one
place to reason about shortcut conflicts.

**R3.** Reuse the existing guard verbatim:

```js
if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
```

This is load-bearing here: the user will be typing notes in a textarea, and
`Alt+B` must not fire from inside it.

**R4.** The guard covers the **host page**. Keystrokes inside the panel iframe
are a different document and never reach this listener — so if `Alt+B` should
also close the panel from inside it, the panel must handle its own keydown and
post `{ bb: 'close' }`. **Decide this explicitly and comment the decision.**
Recommended: yes, handle it, so the shortcut is not mysteriously one-way.

**R5.** `preventDefault()` only when the shortcut actually fires, matching the
existing handler's pattern.

**R6.** Only active on reader pages — where `parseUrl()` is non-null — consistent
with T-017's R8.

**R7.** Document it in `README.md` alongside the existing shortcuts, and in the
panel's own UI (a hint in the header or on the edge tab's `title`).

## Files

- `content.js` — one more case in the existing keydown handler
- `src/ui/panel.js` — the in-iframe counterpart, per R4
- `README.md`

## Reference

- `work/understandings/extension/03-messaging.md` — the `bb:close` message
- `work/understandings/conventions/01-code-style.md`

## Acceptance

- [ ] `Alt+B` opens the panel; pressing it again closes it
- [ ] It does not fire while typing in a bible.com search field
- [ ] It does not fire while typing in the panel's own note editor
- [ ] `Alt+B` from inside the panel closes it (per R4)
- [ ] `Alt+P`, `Alt+A`, `Alt+S`, `Alt+N` are all unaffected
- [ ] It does nothing on a non-reader page
- [ ] The shortcut is documented in `README.md` and discoverable in the UI

## Notes

R4 is the only real decision here. A shortcut that opens but will not close is
the kind of small inconsistency users notice immediately and report vaguely.
