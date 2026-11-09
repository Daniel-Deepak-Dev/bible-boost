# CSS and theming

Confidence: **verified** from `content.css` and `popup.html`.

## Architecture

No preprocessor, no framework, no BEM. Three patterns:

- **On-page CSS** (`content.css`) scopes by id and prefixes every token:
  `#bb-dock .bb-sw`, `--bb-surface`. The prefix prevents collision with
  bible.com.
- **The popup** keeps short unprefixed semantic tokens in an inline `<style>` —
  `--canvas`, `--surface-2`, `--text-1`, `--border`, `--focus`, `--brand` —
  because nothing else shares the document.
- **The panel and notes page** `<link>` `src/shared/theme.css` and use the same
  `--bb-*` names as the dock, so a surface beside the page shares its colours.

State is expressed with **ARIA and data attributes**, not modifier classes:
`[aria-checked="true"]`, `html[data-bb-align]`. Keep this — it means the
accessible state and the visual state cannot drift apart.

## Theme tokens

Light is the `:root` default. Three overrides follow it, in this order:

```css
:root { /* light */ }
@media (prefers-color-scheme: dark) { :root { /* OS dark, page class absent */ } }
html.light { /* page says light */ }
html.dark  { /* page says dark  */ }
```

`html.light` / `html.dark` have specificity (0,1,1) and beat `:root` (0,1,0)
regardless of order. The `@media` block covers first paint, before bible.com has
set its class.

**Only the class is matched.** A `data-theme` attribute on `<html>` does nothing,
and a surface that sets one quietly follows the OS. The panel and notes page set
the `light` or `dark` class.

**`html.light` must restate every colour.** On an OS-dark machine with the page
set to light, the `@media` block has already overwritten `:root`, so anything
`html.light` omits comes through dark.

### Where the tokens live

`src/shared/theme.css` is the full set. `content.css` carries a hand-synced copy
of the ten the dock draws with, because a content script's stylesheet cannot
`@import` a `chrome-extension://` URL reliably:

```css
--bb-sep-color  --bb-surface  --bb-border  --bb-text  --bb-hover
--bb-track-off  --bb-track-on --bb-thumb   --bb-shadow --bb-focus
```

The rest exist only in `theme.css`. On-page UI that needs one has to add it to the
`content.css` block too:

```css
--bb-surface-2  --bb-surface-3  --bb-text-2  --bb-text-3
--bb-accent     --bb-danger     --bb-radius  --bb-gap-sm  --bb-gap-md
```

`--bb-thumb`, `--bb-focus`, `--bb-radius` and `--bb-gap-sm/md` are declared only
in `:root` and deliberately inherited, since they do not vary by theme.
`--bb-gap-sm/md` are unrelated to `--bb-gap`, the alignment spacer `content.js`
writes inline on verses.

### Measured contrast

| Token | On white | On dark `--bb-surface-2` (`#353333`) |
|---|---|---|
| `--bb-text-2` | 6.15:1 (`#636161`) | 6.71:1 (`#BFBDBD`) |
| `--bb-text-3` | 3.93:1 (`#828080`) | 3.20:1 (`#828080`) |
| `--bb-accent` | 4.46:1 (`#3D79C2`) | 2.82:1 (`#3D79C2`) |
| `--bb-danger` | 4.60:1 (`#DE2E3C`) | 3.60:1 (`#FF3D4D`) |

`--bb-text-3` is under the 4.5:1 body text needs, so it is for secondary labels
only. Dark `--bb-surface-2` is the same `#353333` as dark `--bb-border`, so a
border drawn on that fill disappears.

**Accent is blue so that danger can be red.** The brand colour is itself a red, so
a red accent would make a Delete button look like a Save button. The popup's
primary button stays red because it does not use these tokens. Accent and danger
measure only 1.03:1 against each other, so they differ by hue alone and a
destructive control still needs its word. Accent matches `--bb-focus`, so an
accent fill needs an `outline-offset` or its focus ring merges with it. A white
label on dark `--bb-danger` is only 3.48:1, so a filled danger button on dark
takes `#121212` text (5.38:1).

### Checking the cascade

The built-in browser's `prefers-color-scheme` emulation works on a page served
from localhost, so `getComputedStyle` can read every OS and page-class combination
of a page linking `theme.css`. It cannot load the unpacked extension, so anything
about the dock on live bible.com is still a manual check.

## Rules

1. **Always give `var()` a fallback.** An undefined custom property invalidates
   the whole declaration at computed-value time — a gradient-drawn hairline
   disappears silently with no error. The dock's existing token reads in
   `content.css` break this rule and are tracked as B-008.
2. **A popup cannot see the page's theme class.** `popup.html` uses
   `prefers-color-scheme` only. This is the one place the popup and the dock can
   legitimately disagree, and it is accepted.
3. **An iframe cannot see it either.** The panel gets its theme relayed by
   `postMessage` from `panel-host.js`, which needs its own observer on
   `document.documentElement` — the existing one watches `body`. See
   `../bible-com/05-theme-and-page-chrome.md`.
4. **Borrow the page's font stack**, do not bundle one. A bundled font also costs
   a `web_accessible_resources` entry. Commit `a356301` removed a bundled Inter.
5. **`line-height: normal` on small text.** The dock clipped descenders until
   this was fixed.
6. **Honour `prefers-reduced-motion`**, and put it last in the file as
   `content.css` does.
7. **Measure contrast, and record it in a comment.** `--bb-track-on` deliberately
   departs from bible.com's own switch colour because the site's dark-mode "on"
   state measures 1.55:1 against its "off" state at this size.

## Comment style

CSS comments here are as substantial as the JS ones, with the same section
banners (`/* ---------- Verse separators ---------- */`) and the same habit of
recording measured values and layout reasoning. Keep it up.
