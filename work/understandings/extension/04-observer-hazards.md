# Observer hazards — read before adding ANY DOM to the page

Confidence: **verified by code reading**. This is the highest-risk integration
detail in the whole notes project.

## The hazard

`content.js` registers this:

```js
new MutationObserver((records) => {
  if (records.every(recordIsOurs)) return;
  schedule(records.length);
}).observe(document.body, {
  childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
});
```

`schedule()` throttles to 80 ms + rAF, then runs `remember()` and `refresh()`.
`refresh()` calls `align()`, which:

- queries every verse in both columns,
- calls `getBoundingClientRect()` and `getComputedStyle()` per verse,
- **forces synchronous layout repeatedly**, deliberately, because each gap shifts
  what follows it.

On a long chapter that is a genuinely expensive pass.

## Why the notes feature triggers it

Any node BibleBoost adds **inside `document.body`** is a `childList` mutation:

| New thing | Fires the observer? |
|---|---|
| Injected menu row in bible.com's popover | **Yes** |
| Panel host element being created | **Yes**, once |
| Panel host width / class changes | **Yes** if class changes |
| Save chip appearing and disappearing | **Once**, the first time. After that it toggles `hidden`, which is not observed |
| Typing inside the panel **iframe** | **No** — a different document |
| Panel squeezing the page (width change) | Via ResizeObserver, which is **wanted** |

Without a guard, any of these that repeats can re-run `align()` several times a
second. The rows marked **Yes** still fire the observer. The guard below decides
which of them reach `schedule()`.

## Why the original code was safe and element-adding code is not

Before T-004 the code was safe by accident of what it wrote: only `data-*` and
inline `style` attributes, neither of which is observed, so there was no feedback
loop.

The notes feature breaks that invariant because it adds and removes **elements**,
not just attributes.

## The guard (task T-004)

1. Mark every element BibleBoost inserts into the page with `data-bb-own`. One
   marker on the root covers its whole subtree, because `closest()` walks up.
2. In the observer callback, ignore a batch whose records are all ours:

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
```

3. **Verify it.** Set `DEBUG_SCHEDULE = true` in `content.js`, reload the
   extension, use the new UI, and confirm the console stays quiet. This is the
   acceptance test for T-004 and it should be re-run whenever new page-side UI is
   added. Set it back to `false` afterwards.

## What the records actually look like

Verified against a real `MutationObserver` during T-004, 21 cases, and the task's
acceptance checks then passed by hand on live bible.com on 2026-11-09. The first
version of this guard got these wrong, so do not simplify them away:

- **A removed node is already detached when the callback runs.** Its parent
  pointers are gone, so `closest()` cannot reach the marked parent it came from,
  and a removed text node has `parentElement === null`. Only `r.target` still says
  where it lived. Requiring removed nodes to pass `isOurs` made
  `div.textContent = 'x'` and `dock.replaceChildren()` read as not ours.
- **A marked root under a bible.com parent has a target that is not ours.**
  `closest()` starts at the element itself, so the root still finds its own
  marker, even detached. Requiring an owned target would make every appearance of
  a chip on `body` or a row in the verse menu cost a pass.
- **`[].every()` is `true`.** A class change has empty `addedNodes` and
  `removedNodes`, so a check on the nodes alone needs `changed.length > 0`, or
  every class bible.com touches counts as ours.
- **A bible.com node added under one of our elements cannot be detected.**
  `closest()` finds our ancestor either way. React only inserts into nodes it
  created, so this is accepted rather than guarded.

The save popover (T-014) was measured the same way, on live bible.com, with
`schedule()` counting its calls. Opening it, typing, the suggestion lists, adding
chips and closing it again came to 26 batches of records, every one ours, and
`schedule()` stayed at the 2 calls it had before the popover first opened. `open` on a
`<dialog>` is not observed, because only `class` is.

The save chip (T-015) was measured through a local proxy of the real page. Twelve
show-and-hide cycles, driven by a text range so that bible.com added nothing of its own,
came to no mutation records and no `schedule()` calls. Its first appearance on a fresh page
added no `schedule()` call either, because the guard drops that one record.

The panel host (T-017) was measured through a local proxy of the real page. Ten opens
and closes made no `schedule()` calls, while two class changes on `body` straight
afterwards made two, so the count was live. It toggles `hidden` and `aria-expanded`,
and neither is observed.

The pinned squeeze (T-018) writes `--bb-squeeze` inline on `<html>` and
`data-bb-pinned` on the panel's own box. Neither is observed: `<html>` is outside
`body`, and only `class` is watched. What re-runs alignment is the reflow: at
1400x900 a 30% squeeze took each column from 534px to 327px wide, and a
`ResizeObserver` on the columns fired once for it (measured with no extension,
2026-11-10). Whether `content.js`'s own observer then counts one or a few `schedule()`
calls across the 0.2s transition is not yet measured, because the run that could have
shown it was in a hidden pane (below).

A marked root that shifts the text is still caught: the `ResizeObserver` on the
columns calls `schedule()` independently of this guard. That only sees a change
in the column's height, so UI placed inside the verse columns would need more
thought. No task planned so far does that.

## Reading the `DEBUG_SCHEDULE` log

- `not a mutation` means `ResizeObserver`, a window event, a font load, or the URL
  poll. `schedule` is handed directly to those, so its argument is only a record
  count when it is a number.
- Toggling Align logs `not a mutation`, and only on a chapter with non-zero gaps.
  `save()` calls `refresh()` directly and the dock's rebuild is ours, so the
  column resizing is the only thing left to log.
- `characterData` is not observed. In a guard test, `node.data = 'x'` logs nothing
  with or without the guard, so it proves nothing. Use `textContent` or `append`.
- Logging is `console.log` on purpose. Chrome hides `console.debug` by default,
  and a hidden log would look like a passing test.
- **A hidden browser pane never delivers `ResizeObserver` callbacks.** They run in
  the rendering step, which a hidden page skips, as it skips
  `requestAnimationFrame` and CSS transitions. A squeeze there left alignment 1404px
  out with `schedule()` never called, which looks exactly like the observer missing a
  resize. Seen 2026-11-10 (T-018). Show the pane, or treat the log as saying nothing.
- With the console on Verbose, a verse tap can also print `[Violation] Forced
  reflow while executing JavaScript took 30ms` (seen 2026-11-09). Chrome does not
  name the source. `align()` forces layout on purpose and runs after every tap,
  because bible.com's class writes pass the guard, while `capture.js` reads no
  layout at all. It is expected, not a sign of a capture problem.

## Other code reading these records

`src/content/capture.js` learns bible.com's selection class from this same observer,
through `BB.capture.noteMutations(records)`, so it needs no observer of its own. The
call comes after the guard and after `schedule()`, so a bug in capture cannot stop
alignment.

Anything added here has to stay proportional to the records and cheap per record.
One verse tap is 65 class records on Exodus 13 in parallel, 63 of them writing the
value that was already there, and every tap also re-adds the menu's colour swatches
as `childList` records. See `../bible-com/06-verse-action-menu.md`.

## Related trap

The observer watches **`body`**. The theme class is on **`html`**, outside it —
see `../bible-com/05-theme-and-page-chrome.md`. Today that is handled in pure
CSS; any JS that needs the theme must add its own observer on
`document.documentElement`.

## Rule of thumb

> Everything BibleBoost puts on a bible.com page carries `data-bb-own`.
> No exceptions — the guard is only as good as the marking.
