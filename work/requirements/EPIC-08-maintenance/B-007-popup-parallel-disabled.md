# B-007 — The popup's Parallel switch is disabled on a live bible.com chapter

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | In progress |
| Type | Pre-existing |
| Found by | [T-002](../EPIC-00-foundations/T-002-service-worker.md) acceptance run, 2026-11-09 |
| Blocks release | No |
| Size | XS |
| Risk | Low |

## The observation

With a bible.com chapter on screen, the toolbar popup showed the **Parallel mode**
row greyed out, with the note "(open a bible.com chapter)". Everything else in the
popup read correctly: the other switches, both version pickers and "Opens 1TI 6",
so storage was fine. The user reported it as happening the first time.

## Why it happens

The row goes grey only when nothing in the tab answers the popup's `state`
message. The popup read that silence as "this is not bible.com", which is wrong
in two cases:

1. **The tab was already open when the extension was installed, updated or
   reloaded.** Chrome does not inject content scripts into a tab that is already
   open, so nothing answers until that tab is reloaded. **Confirmed as the cause
   of the report on 2026-11-09:** the acceptance run had just reloaded the
   extension, and reloading the bible.com tab made the row work.
2. **The page is still loading.** Content scripts run at `document_idle`, so every
   page load has a window with nothing listening yet.

T-002 did not cause this. `state` travels over `chrome.tabs.sendMessage`, which
never reaches the worker, and T-002 did not touch this path in `popup.js`.

## Scope

**In:** the note's wording, and asking again so the row can recover by itself.

**Out:** making the switch work in an already-open tab without a reload. That
would need re-injection, so new permissions (`scripting`, `activeTab`), and the
old copy of the content script is still running in that page with its observers,
timers and dock. It would have to shut itself down first, or two copies would
align the same verses against each other.

## Requirements

**R1.** The row's note says to open **or reload** a bible.com chapter, because the
popup cannot tell an already-open bible.com tab from another site.

**R2.** After no reply, the popup asks again every 500 ms for up to 10 s, and
re-enables the row and clears the note as soon as a reply arrives.

**R3.** The first ask is unchanged, so a ready tab shows no grey flash.

**R4.** No new permission. `05-mv3-constraints.md` says why `tabs` stays out.

## Files

- `popup.js` — the Parallel mode block
- `work/understandings/extension/03-messaging.md` — corrects "a failed reply means
  not bible.com"

## Reference

- `work/understandings/extension/03-messaging.md` — existing messages
- `work/understandings/extension/05-mv3-constraints.md` — re-injection, permissions

## Acceptance

- [ ] On a bible.com tab opened before the extension was reloaded, the row is grey
      and the note says to reload
- [x] After reloading that tab, the row is enabled
- [ ] Opening the popup while a chapter is still loading: the row enables by itself
      once the page is ready, without reopening the popup
- [x] On a ready chapter the row is enabled at once, and the switch works
- [ ] On a page that is not bible.com the row stays grey, and the popup's console
      logs nothing

## Notes

The retry logic was exercised against a stubbed `chrome` in plain Node: a ready
tab, a tab that answers on the third ask, a tab that never answers, and no tab.
The ticked items are the only ones confirmed in a real Chrome so far.
