# T-008 — Verse selection detection, with layered fallbacks

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Done |
| Depends on | T-001 |
| Blocks | T-012, T-013, T-015, T-016 |
| Size | M |
| Risk | **High** — depends on undocumented bible.com behaviour |

## Why

Nothing in the extension currently knows which verse the user has selected. It
has never needed to — the founding design deliberately leaves bible.com's verse
interaction alone.

The hard part is that the class bible.com puts on a selected verse is a **hashed
CSS-module name** that will change between builds. Hardcoding it guarantees a
future outage. This project has already been bitten by exactly this: the original
section-heading matcher tested for `/_s\d/` and **never fired once on a live
page**, because the build emits a plain `_s`.

## Scope

**In:** a module that answers "which verses are selected right now", and notifies
when that changes.

**Out:** anything that *uses* the answer — the menu row (T-013), the save chip
(T-015), the popover (T-014).

## Requirements

**R1.** Create `src/content/capture.js` exposing
`BB.capture.getSelection() -> { usfms: string[], source: string } | null` and
`BB.capture.onChange(cb)`.

**R2. Primary strategy — learn the selection class at runtime.** Keep a
`WeakMap` of verse element to last-seen `className`. On a `class` mutation,
compare: the elements that *gained* a common new token are the selected ones.
Cache the discovered token for the session, but **re-verify** rather than trust
it forever.

The existing observer already watches `attributeFilter: ['class']`, so the signal
costs nothing new — but route it through the T-004 guard, and do **not** add a
second body-wide observer.

**R3. Fallback 1 — the menu header.** bible.com's popover header is a link whose
`href` holds the selected reference in canonical form, such as
`/bible/339/EXO.13.1-2,4.TAOVBSI`. Read that, inside `main`, and only for the
chapter `BB.dom.parseUrl()` reports. Do **not** parse the visible text: its book
name is localized (Tamil, in the primary user's case), there is no name table in
this codebase, and a book or version abbreviation can contain digits of its own.

**R4. Fallback 2 — `window.getSelection()`.** Test each column verse against the
range with `intersectsNode`, and require the overlap to contain non-whitespace
text. Do not walk down from the common ancestor: for any drag across two verses
that is the chapter wrapper, and every verse is below it. This catches text-drag
selection, which the class strategy does not.

**R5.** Try the strategies in order and report which one answered, in `source`.
Log the fallback level at `DEBUG` so a future regression is diagnosable from a
user's console rather than by guesswork.

**R6.** Return canonical `data-usfm` values, always `.split('+')[0]`. Order them
in document order, not selection order.

**R7.** Return `null`, never throw and never an empty array, when nothing is
selected. Callers branch on null.

**R8.** Ignore verse elements outside the reader columns — bible.com clones verse
nodes into popovers and share sheets, and `content.css` already has a comment
about this. Scope queries to `BB.dom.columnEls()`.

## Files

- `src/content/capture.js` — new
- `src/content/bible-dom.js` — `VERSE_SEL` and `usfmOf`, so the selector keeps one
  home
- `content.js` — one call in the existing observer, after the T-004 guard
- `manifest.json` — add to the `js` array, after `content.js`

## Reference

- `work/understandings/bible-com/06-verse-action-menu.md` — **run its inspection
  recipe first and update it**
- `work/understandings/bible-com/02-verse-dom.md` — `data-usfm` traps, the `+`
  split, continuation fragments
- `work/understandings/extension/04-observer-hazards.md` — do not add a second
  body-wide observer
- `work/understandings/bible-com/07-i18n-and-scripts.md` — why R3 must not parse
  the book name

## Acceptance

- [x] Tapping one verse reports exactly that verse's usfm
- [x] Tapping a second verse to extend reports both, in document order
- [x] Deselecting reports `null`
- [x] Tapping works whichever language is in the primary column (TAOVBSI primary
      and NKJV primary). bible.com's parallel column ignores taps, so a tap there
      reports `null`, and a text drag there reports the covered verses
- [x] Works on a single-version page and in parallel mode
- [x] Dragging across text reports the covered verses (fallback 2)
- [x] A combined `data-usfm` (`X+Y`) reports only the first key
- [x] After client-side navigation to another chapter, detection still works
- [x] Temporarily renaming the cached selection class forces a re-discovery
      rather than a permanent failure
- [x] `work/understandings/bible-com/06-verse-action-menu.md` has been updated
      with what was actually found, and its confidence banner changed
- [x] The extension loaded unpacked passes the standing regression check in
      CLAUDE.md, and the Verbose console shows
      `[BibleBoost] capture: learned selection class` on the first tap

## Notes

**The most valuable output of this task is the updated understanding file**, not
the code. Write down the real selectors, the real structure, and anything that
surprised you.

### How the ticked items were verified

On live bible.com on 2026-11-09, logged out, at a 1600px viewport, with real taps
and drags. The browser used cannot load an unpacked extension, so `bible-dom.js`
and `capture.js` were injected into the page with comments stripped, and a stand-in
`MutationObserver` called `noteMutations` the way `content.js` does.

The last acceptance item covers what the injection could not: the manifest's load
order, the isolated world, `content.js` reaching `BB.capture`, and alignment still
working. It was done by hand with the unpacked extension in Chrome on 2026-11-09.
The Verbose console read as it should: `learned selection class` and `answered by
class` on the first tap, `answered by nothing` on deselecting, and `answered by
class` on the next tap with no second `learned` line, so the cached class held.

To repeat the rename check, pick the BibleBoost context in the DevTools console
and run `BB.capture.debug.token = 'x'`.

Not checked: a signed-in session, a non-English interface language, and whether
applying a highlight adds a class to the verse. If it does, `reconcile()` only
guards against it while the menu names verses.
