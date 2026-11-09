# T-004 — Observer ignore-guard for BibleBoost's own DOM

| Field | Value |
|---|---|
| Epic | EPIC-00 Foundations |
| Status | Done |
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
is entirely ours. A record is ours when its target is ours, or when it changed
nodes and every one of them carries the marker:

```js
function isOurs(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return !!el?.closest('[data-bb-own]');
}

function recordIsOurs(r) {
  if (isOurs(r.target)) return true;
  const changed = [...r.addedNodes, ...r.removedNodes];
  return changed.length > 0 && changed.every(isOurs);
}

new MutationObserver((records) => {
  if (records.every(recordIsOurs)) return;
  schedule(records.length);
}).observe(document.body, { /* unchanged */ });
```

**R3.** Do **not** narrow the observer's scope to the columns instead. The
observer must keep seeing chapter navigation, version changes and bible.com's
own re-renders anywhere in the body.

**R4.** Neither the target alone nor the nodes alone are sufficient:

- A removed node is already detached when the callback runs, so `closest()`
  cannot reach the marked parent it came from. Only the target proves it was ours.
- A marked root added to or removed from a bible.com parent has a target that is
  not ours. Only the marker on the node proves it is ours. T-013 and T-015 depend
  on this.
- A class change has no changed nodes and `[].every()` is `true`, so the length
  check is what stops bible.com's class changes counting as ours.

A bible.com node added under one of our elements cannot be told apart, because
`closest()` finds our ancestor either way. The guard does not try: React only
inserts into nodes it created.

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

- [x] With `DEBUG_SCHEDULE = true`, loading a parallel chapter logs a burst of
      calls during page settle, then goes quiet
- [x] Toggling the dock's Align switch logs calls (it should — real work)
- [x] Adding a throwaway `<div data-bb-own>` to `document.body` from the console,
      then mutating its contents repeatedly, logs **nothing**
- [x] Removing `data-bb-own` from that div and repeating logs calls again,
      proving the guard is what suppressed them
- [x] bible.com's own chapter navigation still triggers re-alignment
- [x] `#bb-dock` carries `data-bb-own`

## Notes

The guard is only as good as the marking. When reviewing any later task that
adds page DOM, check for `data-bb-own` first.

R2 and R4 were rewritten during implementation. The original rule required an
owned target and tested removed nodes with `closest()`, which failed the third
acceptance item and contradicted T-013 R5 and T-015's acceptance.

All six acceptance items and the standing regression check were run by hand on
`/bible/339/EXO.13.TAOVBSI?parallel=114` with the extension loaded, and passed on
2026-11-09. Before that, `recordIsOurs` passed 21 cases against a real
`MutationObserver` on a neutral page. The original rule wrongly reported 8 of the
owned cases as not ours.

When running the checks: replace the div's contents with `textContent` or
`append`. `node.data = ...` is a `characterData` change, which is not observed,
so it logs nothing with or without the guard. Toggling Align should log
`not a mutation`, because those calls come from the column `ResizeObserver`.
