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
| Save chip appearing and disappearing | **Yes**, every time |
| Typing inside the panel **iframe** | **No** — a different document |
| Panel squeezing the page (width change) | Via ResizeObserver, which is **wanted** |

Without a guard, typing a note with the save chip visible can re-run `align()`
several times a second. All of these still fire the observer. The guard below
decides which of them reach `schedule()`.

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

## Related trap

The observer watches **`body`**. The theme class is on **`html`**, outside it —
see `../bible-com/05-theme-and-page-chrome.md`. Today that is handled in pure
CSS; any JS that needs the theme must add its own observer on
`document.documentElement`.

## Rule of thumb

> Everything BibleBoost puts on a bible.com page carries `data-bb-own`.
> No exceptions — the guard is only as good as the marking.
