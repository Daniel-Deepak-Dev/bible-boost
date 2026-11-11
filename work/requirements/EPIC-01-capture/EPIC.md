# EPIC-01 — Capture a verse

**Goal:** select a verse on bible.com and save it as a note, with both parallel
versions' text, a topic and tags — reliably enough that a bible.com redesign
degrades the feature instead of killing it.

This epic contains the project's most fragile code. bible.com's verse menu is
rendered by the site's own framework, stays mounted off-screen between selections,
and redraws parts of itself on every selection. The
strategy throughout is **layered**: discover things at runtime instead of
hardcoding them, and always ship a second path that does not depend on the first.

## Tasks

| Id | Title | Depends on |
|---|---|---|
| [T-008](T-008-selection-detection.md) | Verse selection detection, with layered fallbacks | T-001 |
| [T-009](T-009-extract-verse-text.md) | Clean verse-text extraction | T-001 |
| [T-010](T-010-parallel-lookup.md) | Parallel column text lookup | T-001, T-009, T-011 |
| [T-011](T-011-version-resolution.md) | Version abbreviation and language resolution | T-001 |
| [T-012](T-012-display-ref.md) | Localized reference capture | T-008 |
| [T-013](T-013-menu-injection.md) | Inject the save row into bible.com's verse menu | T-004, T-008 |
| [T-014](T-014-save-popover.md) | Save popover — topic, tags, note body | T-005, T-013 |
| [T-015](T-015-quickbar-fallback.md) | Independent save chip and Alt+N | T-004, T-008 |
| [T-016](T-016-verse-ranges.md) | Multi-verse range capture | T-008, T-010 |

T-008 is the spine — almost everything else needs it. T-009, T-011 can start in
parallel with it.

## Before you start: inspect the menu

`work/understandings/bible-com/06-verse-action-menu.md` records bible.com's
selection class and menu structure, verified live during T-008. **Read it first,
and update it if the page has moved on** — every task below depends on what it
says.

## Definition of done

- [x] Selecting a verse shows a BibleBoost row in bible.com's menu
- [x] Saving captures: canonical `usfm`, localized ref, both versions' abbr,
      language and text, topic, tags and body
- [x] `Alt+N` saves the current selection even with the menu suppressed
- [x] A multi-verse range saves as one note with one `VerseRef` per verse
- [ ] Alignment, separators and `Alt+P/A/S` are unaffected
- [ ] With `DEBUG_SCHEDULE = true`, saving does not spam `align()`

### Where the ticks come from (2026-11-11)

None of these was checked afresh at epic level. Each tick points at a task box that was
checked by hand in the user's real Chrome on live bible.com, as that task's Notes record:

1. The row in the menu: T-013, "Selecting a verse shows the row between Highlight and
   Copy".
2. What a save captures: T-014's first three boxes, the note with its topic, two tags and
   body, both versions' abbr, language and text, and the canonical `usfm` with the
   localized `displayRef`.
3. `Alt+N` without the menu: T-015, "`Alt+N` saves the selection with no mouse" and the
   run with `menu.js` removed from the manifest.
4. A range as one note: T-016, "Selecting Exodus 13:2-4 creates one note with three
   `VerseRef`s".

Two stay empty:

5. **Alignment, separators and `Alt+P/A/S`.** Alignment and separators passed the
   standing regression in the real-Chrome checks of T-014 and T-016. `Alt+P/A/S` do
   nothing in the user's Chrome, before this epic and since, which is
   [B-006](../EPIC-08-maintenance/B-006-shortcuts-dead-in-chrome.md). Tick this when that
   is settled, or when the user decides to except it.
6. **`DEBUG_SCHEDULE` during a save.** T-013 counted passes while the menu opened and
   closed, and T-015 while the chip came and went, but no task recorded a count across a
   *save*: the popover opening, the worker answering, the toast and the close. To check
   it, set `DEBUG_SCHEDULE = true` in `content.js`, reload the extension and the tab,
   save a verse through the popover, and read the Console for `[BibleBoost] schedule:`
   lines. Tapping the verse logs some, as T-013 found, because bible.com's own class
   writes pass the guard. Opening the popover, typing in it, saving and the toast should
   add none of their own.

Two bugs in the popover are still open as well, though neither unticks a box above:
[B-013](../EPIC-08-maintenance/B-013-topic-enter-picks-uncategorized.md) and
[B-017](../EPIC-08-maintenance/B-017-popover-lists-overwrite-choices.md), each waiting
only on the standing regression in real Chrome.

## The resilience rule

Every task here must answer: **what happens when bible.com changes this?**
A feature that can only work by matching a hashed class or an English word is not
finished. Fallbacks are not optional polish; they are the requirement.
