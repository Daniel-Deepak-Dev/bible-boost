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

- [ ] Selecting a verse shows a BibleBoost row in bible.com's menu
- [ ] Saving captures: canonical `usfm`, localized ref, both versions' abbr,
      language and text, topic, tags and body
- [ ] `Alt+N` saves the current selection even with the menu suppressed
- [ ] A multi-verse range saves as one note with one `VerseRef` per verse
- [ ] Alignment, separators and `Alt+P/A/S` are unaffected
- [ ] With `DEBUG_SCHEDULE = true`, saving does not spam `align()`

## The resilience rule

Every task here must answer: **what happens when bible.com changes this?**
A feature that can only work by matching a hashed class or an English word is not
finished. Fallbacks are not optional polish; they are the requirement.
