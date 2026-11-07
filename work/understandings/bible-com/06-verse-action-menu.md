# bible.com — the verse action menu

> **Confidence: PARTLY UNVERIFIED.** Everything under "Observed" comes from a
> screenshot. Everything under "Unknown" **must be inspected on a live page
> before writing code against it**. Update this file with what you find — that is
> the single most valuable thing the first implementation session can leave
> behind.

## Observed

Tapping a verse opens a dark popover near the selection containing, top to
bottom:

```
Currently Selected:
<localized ref> <VERSION ABBR>  >          [X close]
---------------------------------------------
Highlight     (-)  [yellow] [green] [blue] [orange] [pink] ...
---------------------------------------------
Copy
---------------------------------------------
Compare
---------------------------------------------
Share
```

- The header shows the localized reference and the version abbreviation, e.g. the
  Tamil rendering of Exodus 13:2 followed by TAOVBSI.
- The Highlight row is a colour strip with a "no colour" button first.
- Rows below it are a vertical list of icon + label.
- The UI chrome is in the **interface** language, not the Bible version's
  language. The sidebar language selector is separate from the version.

## Unknown — inspect before coding

- [ ] The popover's container selector and whether it is portalled to `body`
- [ ] Whether it is re-created per selection or reused and repositioned
- [ ] The class bible.com adds to a **selected verse** element
- [ ] The action list's container, and whether rows are `button`, `a` or `div`
- [ ] Whether the row labels are text nodes or `aria-label`
- [ ] Whether a range selection changes the structure

### Inspection recipe

1. Open a chapter, select a verse, open DevTools.
2. In the Elements panel, use "Break on > subtree modifications" on `body` to
   catch the popover being inserted.
3. Run this in the console **before** selecting, then select, to learn the
   selection class by diffing:

```js
const before = new Map();
document.querySelectorAll('[data-usfm]').forEach(e => before.set(e, e.className));
// ...now click a verse...
document.querySelectorAll('[data-usfm]').forEach(e => {
  if (before.get(e) !== e.className) console.log(e.dataset.usfm, before.get(e), '->', e.className);
});
```

4. Record the findings in this file, move the checkboxes to Observed, and change
   the confidence banner.

## Integration strategy (decided — see T-015, T-016)

The menu is React-rendered, re-created on selection, and its class names are
hashed. **A redesign will break any injection.** Therefore:

1. **Discover the selection class at runtime** by diffing `class` attributes
   rather than hardcoding one. The existing observer already watches
   `attributeFilter: ['class']`, so the signal is free.
2. **Anchor positionally, not by the word "Copy".** The interface language can be
   anything; matching English text is a localization bug waiting to happen.
   Insert relative to the action list's children, and **append at the end if the
   anchor is not found** — never fail to insert.
3. **Inject idempotently.** Check for an existing node by `data-bb-own` before
   adding; the popover will be re-created many times.
4. **Mark every injected node `data-bb-own`** so the observer guard
   (`extension/04-observer-hazards.md`) can ignore it.
5. **Always ship the independent fallback** — the extension's own save chip plus
   a keyboard shortcut (T-016) — so the feature degrades instead of dying.

## Do not fight the page

The project's founding rule, stated in `content.js` and the README: BibleBoost
**keeps bible.com's own verse DOM** so that tap-to-highlight, Copy, Compare and
Share keep working. Adding a row to the menu is additive. Never remove,
re-order or re-render bible.com's own rows.
