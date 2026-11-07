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
- Floating switch, bottom-right: **Parallel** (on/off) and **Align verses** (on/off).
- Shortcuts: Alt+P parallel, Alt+A align.
- Toolbar popup: same toggles, show/hide the on-page switch, and the version used when turning parallel on.
- Change versions with bible.com's own pickers; the last parallel version you pick is remembered.

**How it works**
Each verse's first span gets a small invisible block before it (CSS ::before). This starts every verse on a new line, and its height
is set so the higher column is pushed down to match the other. Nothing is removed or re-rendered, so all native features keep working.
It re-aligns automatically on chapter change, version change, window resize, and the reader's text-size setting.

Note: on narrow windows (under ~768px) bible.com itself hides the second column, so there's nothing to align.

---
BibleBoost is an independent project and is not affiliated with or endorsed by YouVersion or Life.Church.
