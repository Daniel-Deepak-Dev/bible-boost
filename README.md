# BibleBoost (Chrome extension)

Power-ups for Bible.com.

## Install / update
1. Unzip.
2. chrome://extensions → Developer mode on → **Load unpacked** → pick `bible-boost`.
3. Reload any open bible.com tabs.

Coming from **Bible.com Parallel Reader**: remove the old extension first. Your settings reset once, because Chrome gives a renamed
unpacked folder a new extension ID.

## Features

### Parallel reading
Lines up verses side by side in bible.com's parallel mode: verse N starts on the same line in both columns.
It keeps bible.com's own verses, so tapping a verse still opens Highlight / Copy / Compare / Share.

**Use**
- Floating switch, bottom-right: **Parallel** and **Align verses**. It stays out of the way — at rest it
  collapses to the two shortcut letters (`P` / `A`) and dims; hovering or tabbing into it spells the labels out.
  The on/off tracks never collapse, so you can still read the state at a glance without reaching for it.
- Shortcuts: Alt+P parallel, Alt+A align, Alt+S separators. Change them at `chrome://extensions/shortcuts`.
- Toolbar popup: all the toggles including **Verse separators**, show/hide the on-page switch, and both versions.
- Separators are deliberately not on the floating switch — it is set once and then left alone, so it lives in
  the popup and on Alt+S. Hide the switch entirely in the popup if you prefer the shortcuts.

**How it works**
Each verse's first span gets a small invisible block before it (CSS ::before). This starts every verse on a new line, and its height
is set so the higher column is pushed down to match the other. Nothing is removed or re-rendered, so all native features keep working.
It re-aligns automatically on chapter change, version change, window resize, and the reader's text-size setting.

Note: at phone width bible.com itself drops back to a single column, so there is nothing to align and BibleBoost removes its spacing again. Around 700px both columns were still shown in testing, so the cut-off is bible.com's to decide, not ours.

### Open parallel reading
A button at the top of the toolbar popup opens bible.com straight into parallel mode, at the chapter you last read, with the two
versions you last used. If the tab you are on is already bible.com it navigates there; otherwise it opens a new tab.

Both versions and your last chapter are remembered as you read — change them with bible.com's own pickers, or set them directly in
the popup (**Left version** / **Right version**, each accepting a bible.com ID or a pasted URL).

Picking the same version on both sides is refused: bible.com collapses to a single column when the two match.

### Verse separators
A hairline between aligned verse rows, so it stays obvious which verse on the left goes with which on the right. It is drawn in the
gap the alignment already creates, anchored to the one edge that is identical in both columns, so both sides line up exactly.

It follows bible.com's own theme — `html.light` and `html.dark` each get their own colour — and is deliberately faint
(about 10% in light, 13% in dark). No line is drawn above the first verse of a chapter.

Where a translation starts a new section, the line is drawn **above** the heading rather than below it, so the heading stays with
the verses it introduces. Translations divide sections differently, so one column often has a heading where the other has none; the
column without one is given just enough room to carry its line at the same height. Turn it off with Alt+S or in the popup.

## Development

The tests cover the pure logic: verse references, text normalization, validation and migrations. They need Node 22 or later and
nothing else, so there is no install step. Run this from the repository root, with no path:

```bash
node --test
```

Behaviour on a live bible.com page is checked by hand. See [`test/README.md`](test/README.md) for where that line falls.

---
BibleBoost is an independent project and is not affiliated with or endorsed by YouVersion or Life.Church.
