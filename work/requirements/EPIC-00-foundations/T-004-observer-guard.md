# T-004 — Observer ignore-guard for BibleBoost's own DOM

| Field | Value |
|---|---|
| Epic | EPIC-00 Foundations |
| Status | Not started |
| Depends on | — |
| Blocks | T-013, T-015, T-017 (everything that adds page DOM) |
| Size | S |
| Risk | **High if skipped** — the bug it prevents is hard to attribute |

## Why

`content.js` observes `document.body` with `{childList, subtree, attributes:
['class']}`, and every fire runs `align()` — which queries every verse in both
columns and deliberately forces synchronous layout, repeatedly.

Today that is safe **by accident**: the extension only writes `data-*` and inline
`style`, neither of which the observer watches. The notes feature breaks that
invariant, because it adds and removes **elements**.

Without this guard, a visible save chip or an injected menu row can re-run a full
alignment pass several times a second while the user types. The symptom — a
sluggish reader — appears in EPIC-02 and looks like a panel problem, not an
observer problem.

**Do this before any page-side UI lands.**

## Scope

**In:** the ownership marker convention, the guard in the observer callback, and
a way to verify it.

**Out:** the UI that will need it.

## Requirements

**R1.** Establish the convention: **every element BibleBoost inserts into a
bible.com page carries `data-bb-own`.** Apply it to the existing `#bb-dock` as
part of this task, so the convention has a user from day one.

**R2.** Filter the observer callback. Ignore a batch only when **every** record
is entirely ours — target *and* added/removed nodes:

```js
function isOurs(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return !!el?.closest('[data-bb-own]');
}

new MutationObserver((records) => {
  const ours = records.every((r) =>
    isOurs(r.target) &&
    [...r.addedNodes, ...r.removedNodes].every(isOurs));
  if (ours) return;
  schedule();
}).observe(document.body, { /* unchanged */ });
```

**R3.** Do **not** narrow the observer's scope to the columns instead. The
observer must keep seeing chapter navigation, version changes and bible.com's
own re-renders anywhere in the body.

**R4.** Checking only `r.target` is not sufficient. A record whose target is ours
but which adds a bible.com node still matters; so does the reverse.

**R5.** Add a debug switch — a module-level `const DEBUG_SCHEDULE = false` that,
when true, logs each `schedule()` call with the triggering record count. Leave it
in the committed code, off. It is the acceptance test for this task and for every
later page-side UI task.

**R6.** Comment the guard in the project's house style, explaining *why* it
exists (the `align()` cost) rather than what it does.

## Files

- `content.js` — the observer callback, `isOurs`, `DEBUG_SCHEDULE`, and
  `data-bb-own` on the dock

## Reference

- `work/understandings/extension/04-observer-hazards.md` — the full analysis,
  including the table of which new things fire the observer
- `work/understandings/conventions/01-code-style.md` — hard rule 5

## Acceptance

- [ ] With `DEBUG_SCHEDULE = true`, loading a parallel chapter logs a burst of
      calls during page settle, then goes quiet
- [ ] Toggling the dock's Align switch logs calls (it should — real work)
- [ ] Adding a throwaway `<div data-bb-own>` to `document.body` from the console,
      then mutating its contents repeatedly, logs **nothing**
- [ ] Removing `data-bb-own` from that div and repeating logs calls again,
      proving the guard is what suppressed them
- [ ] bible.com's own chapter navigation still triggers re-alignment
- [ ] `#bb-dock` carries `data-bb-own`

## Notes

The guard is only as good as the marking. When reviewing any later task that
adds page DOM, check for `data-bb-own` first.
