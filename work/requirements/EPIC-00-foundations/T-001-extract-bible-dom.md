# T-001 — Extract bible.com DOM readers into BB.dom

| Field | Value |
|---|---|
| Epic | EPIC-00 Foundations |
| Status | Done |
| Depends on | — |
| Blocks | T-008, T-009, T-010, T-011 |
| Size | S |
| Risk | **Medium** — touches the working alignment code |

## Why

Verse capture needs exactly the DOM readers `content.js` already has, and those
readers encode hard-won knowledge about bible.com's quirks (combined `data-usfm`
values, verses split across paragraphs, the direct-child-vs-nested label
distinction, inconsistent `vid` classes). Today they are trapped inside an IIFE.

Copy-pasting them would be the third place the project duplicates code — after
`DEFAULTS`, which is already duplicated between `content.js` and `popup.js` and
carries a "keep in sync" comment. Duplicating *selector* logic is worse: when
bible.com changes, one copy gets fixed and the other silently rots.

## Scope

**In:** moving five functions and their comments into a new content-script file
that runs first, and pointing `content.js` at them.

**Out:** changing any behaviour, renaming anything, "improving" any of the moved
code, touching `align()` / `bandTop()` / `levelRules()`.

## Requirements

**R1.** Create `src/content/bible-dom.js` containing, verbatim and with every
comment intact: `parseUrl`, `REF_RE`, `columnEls`, `columns`, `VID_RE`,
`firstSpans`, `verseLabel`.

**R2.** Expose them on an isolated-world namespace, created defensively so load
order cannot break it:

```js
var BB = (typeof BB !== 'undefined') ? BB : {};
BB.dom = { REF_RE, VID_RE, parseUrl, columnEls, columns, firstSpans, verseLabel };
```

**R3.** List `src/content/bible-dom.js` **first** in the manifest's
`content_scripts[0].js` array, before `content.js`. Content scripts are classic
and execute in array order; a later file cannot be imported by an earlier one.

**R4.** `content.js` uses `BB.dom.*` and no longer defines those five functions.
Its own `topOf`, `bandTop`, `align`, `levelRules`, `clearAlign` stay where they
are — they are alignment logic, not DOM reading.

**R5.** Add a `LANG_RE` and a `langOf(col)` helper to `bible-dom.js` that reads
the ISO 639-3 code from a column's `iso6393xxx` class, returning `null` when
absent. Nothing consumes it yet; T-011 will.

**R6.** No behaviour change of any kind.

## Files

- `src/content/bible-dom.js` — new
- `content.js` — remove the moved functions, call through `BB.dom`
- `manifest.json` — add the file at the head of the `js` array

## Reference

- `work/understandings/bible-com/02-verse-dom.md` — why `firstSpans` and
  `verseLabel` are shaped the way they are
- `work/understandings/bible-com/03-columns-and-versions.md` — the `vid` and
  `iso6393` tokens
- `work/understandings/extension/05-mv3-constraints.md` — why content scripts
  cannot use ES modules and must share a global
- `work/understandings/conventions/01-code-style.md`

## Acceptance

- [x] On `/bible/339/EXO.13.TAOVBSI?parallel=114`, verses align exactly as before
- [x] Verse separators draw, including above section headings
- [ ] `Alt+P`, `Alt+A`, `Alt+S` all still work — **failing in the live test
      2026-11-08**, while the dock's switches work. Under investigation: the
      keydown handler is byte-identical to the pre-T-001 build and handles
      synthetic Alt+P/A in both, so the cause is suspected to be outside the
      code: keyboard focus or AltGr. **bible.com is ruled out**, because real
      Alt+P/A/S presses reach `document` unprevented
      (`understandings/bible-com/05-theme-and-page-chrome.md`, Keyboard).
      A test `keydown` listener pasted into the user's console logged nothing
      for Alt+P. It also logged nothing for a plain `P`, so that listener was
      never running and the result proves nothing either way. **Moved to
      [B-006](../EPIC-08-maintenance/B-006-shortcuts-dead-in-chrome.md)**, which
      delivers the shortcuts through `chrome.commands` instead.
- [x] Changing the reader's "Aa" font size still re-aligns
- [x] Navigating to another chapter client-side still re-aligns
- [x] A single-version page (no `parallel` param) shows the dock with only the
      Parallel switch, and no alignment artefacts
- [x] `BB.dom.langOf()` returns `'eng'` for the NKJV column and `'tam'` for the
      TAOVBSI column — `BB.dom.columns().map(BB.dom.langOf)` gave
      `['tam', 'eng']` on the live page, 2026-11-08
- [x] `git diff` shows the moved functions unchanged apart from indentation
      — byte-for-byte, indentation included, since `bible-dom.js` keeps them
      inside an IIFE at the same depth. Checked by comparing the moved ranges of
      `HEAD:content.js` against the new file.

## Notes

Verify by **using** the extension, not by reading the diff. Alignment bugs are
visual and the measuring code is order-sensitive.

**Done with one box unticked, on purpose.** `Alt+P/A/S` did nothing in the
user's Chrome. The handler is not part of this change, and the same failure
persisted after the shortcuts were moved to `chrome.commands`, so it is tracked
in B-006 rather than holding this task open. The box stays empty because nobody
saw the shortcuts work.

**How R4 is met.** `content.js` takes the readers from `BB.dom` once, by
destructuring at the top of its IIFE, rather than writing `BB.dom.parseUrl()` at
every call site. Qualified calls would have meant editing `align()`, `bandTop()`
and `topOf()`, which Scope / Out forbids. Destructuring is the one reading of R4
that satisfies both.

**Why `bible-dom.js` is an IIFE behind a `var BB`.** Classic content scripts
share one global lexical scope, so a top-level `const REF_RE` would block any
later content script from declaring its own. See
`work/understandings/extension/05-mv3-constraints.md`.
