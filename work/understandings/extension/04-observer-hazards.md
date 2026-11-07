# Observer hazards — read before adding ANY DOM to the page

Confidence: **verified by code reading**. This is the highest-risk integration
detail in the whole notes project.

## The hazard

`content.js` registers this:

```js
new MutationObserver(schedule).observe(document.body, {
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
several times a second.

## Why today's code is safe and the new code is not

The existing code is safe by accident of what it writes:

> Our own changes are `data-*` and inline `style` attributes, which are not
> observed, so there is no feedback loop.

The notes feature breaks that invariant because it adds and removes **elements**,
not just attributes.

## The guard (task T-004)

1. Mark every element BibleBoost inserts into the page with `data-bb-own`.
2. In the observer callback, ignore a batch whose records are all inside an owned
   node:

```js
function isOurs(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return !!el?.closest('[data-bb-own]');
}

new MutationObserver((records) => {
  if (records.every((r) =>
    isOurs(r.target) &&
    [...r.addedNodes, ...r.removedNodes].every(isOurs)
  )) return;
  schedule();
}).observe(document.body, { ... });
```

Check `addedNodes` and `removedNodes` too: a record whose *target* is ours but
which adds a bible.com node still matters, and vice versa.

3. **Verify it.** Temporarily log in `schedule()`, open the panel, type in the
   editor, and confirm nothing fires. This is the acceptance test for T-004 and
   it should be re-run whenever new page-side UI is added.

## Related trap

The observer watches **`body`**. The theme class is on **`html`**, outside it —
see `../bible-com/05-theme-and-page-chrome.md`. Today that is handled in pure
CSS; any JS that needs the theme must add its own observer on
`document.documentElement`.

## Rule of thumb

> Everything BibleBoost puts on a bible.com page carries `data-bb-own`.
> No exceptions — the guard is only as good as the marking.
