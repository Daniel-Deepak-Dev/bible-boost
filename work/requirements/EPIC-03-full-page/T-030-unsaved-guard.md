# T-030 — Unsaved-changes guard

| Field | Value |
|---|---|
| Epic | EPIC-03 Full-page app |
| Status | Not started |
| Depends on | T-026 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

Autosave handles the ordinary case, but there is always a window between the last
keystroke and the debounce firing, and there are paths that bypass it — closing
the tab, navigating the hash, a failed write.

Losing a paragraph of study notes is the kind of failure that ends a user's trust
in an application permanently.

## Scope

**In:** flushing pending saves, warning when a flush is impossible, and
recovering a failed one.

**Out:** the autosave mechanism itself (T-022, T-026).

## Requirements

**R1. Flush before anything that could lose the buffer** — switching note,
changing filter, navigating the hash, collapsing the editor. Flush, do not warn:
the user did not ask a question, so do not ask them one.

**R2.** `beforeunload` warns **only when a save is genuinely pending or has
failed**. A guard that fires on every close trains the user to dismiss it
reflexively, which is worse than not having one.

```js
addEventListener('beforeunload', (e) => {
  if (!hasPendingWrite()) return;
  e.preventDefault();
});
```

**R3. Keep a local draft buffer.** On every change, write the in-progress body to
`storage.local` under a draft key. Clear it on a confirmed save. On page load, if
a draft exists for a note whose stored `updatedAt` is older, offer to restore it.

This is the actual safety net — `beforeunload` cannot be relied on, and
`storage.local` survives a crash.

**R4.** If a save **fails**, keep the editor dirty, show a persistent (not
auto-dismissing) error with a retry, and keep the draft buffer. Never discard the
text, and never silently drop the error.

**R5.** Hash navigation within the page is not a real unload, so `beforeunload`
does not fire. Guard the hash router explicitly.

**R6.** Apply the same flush-on-close in the **panel** (T-022's R1), where
closing is a click away and far more frequent.

**R7.** Show save state honestly: `Saving…`, `Saved`, `Unsaved changes`,
`Save failed`. Quiet, but present. An editor that claims "Saved" when a write
failed is the worst possible outcome.

**R8.** Draft keys include the note id and are cleaned up on a confirmed save and
on note deletion, so `storage.local` does not accumulate orphans.

## Files

- `src/ui/app/editor.js` — flush, draft buffer, save state
- `src/ui/app/store.js` — pending-write tracking
- `src/ui/notes.js` — `beforeunload`, hash guard
- `src/ui/panel.js` — close guard

## Reference

- `work/understandings/extension/02-storage-model.md` — `storage.local` for UI
  state and drafts; durability caveats
- `work/understandings/extension/03-messaging.md` — `notes/update` patches

## Acceptance

- [ ] Typing then immediately switching notes saves the text
- [ ] Typing then immediately closing the tab warns
- [ ] Closing with everything saved does **not** warn
- [ ] Typing, then killing the tab without warning, then reopening: the draft is
      offered for restore
- [ ] A simulated worker failure leaves the editor dirty with a retry, and the
      text intact
- [ ] Retrying after the failure saves successfully and clears the draft
- [ ] Hash navigation mid-edit flushes the save
- [ ] Closing the panel mid-edit flushes the save
- [ ] Save state never shows "Saved" when a write has failed
- [ ] Deleting a note removes its draft key

## Notes

R3 is what actually saves a user's work; `beforeunload` is a courtesy that
browsers increasingly restrict. Build the draft buffer first and treat the
dialog as secondary.

**From T-022 (2026-11-12). There is no autosave any more**, so this task's premise
has moved. The user replaced T-022's autosave with a **Save button** after trying it:
an accidental edit was stored at once, over the old words. `src/ui/app/editor.js`
now stores nothing until Save or Ctrl/Cmd+Enter, says `Unsaved changes` while there
are any, and every way out of the editor goes through `close({ how })`, which asks
before dropping a change (`cancel`) or offers Save, Discard or Keep editing (`ask`).
A failed save shows `Not saved. <error>`, keeps the changes and stays open.

So R1 ("flush, do not warn") no longer fits: a flush would be the very save the user
asked not to happen. Leaving an editor should ask, as it already does in the panel.
Closing the panel keeps the editor and its changes, since the frame only hides. What
is still missing is R3, the draft buffer: a page reload or a crash loses unsaved
changes today, and nothing warns. Do that first. Never act on a message from
`panel-host.js`: nothing arriving by `postMessage` may cause a write
(03-messaging.md).
