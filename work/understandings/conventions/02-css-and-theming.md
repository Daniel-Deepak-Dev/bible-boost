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
  Then they link `src/ui/ui.css`, the styles of the shared views in `src/ui/app/`
  (the note list since T-021), and keep only their own layout inline.

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

`theme.css` ends with a `color-scheme` block for the same three cases, so that
the scrollbar and native controls in the panel follow its theme too. It is
deliberately **not** copied into `content.css`, where the same selectors would set
`color-scheme` on bible.com's own `<html>`.

**`html.light` must restate every colour.** On an OS-dark machine with the page
set to light, the `@media` block has already overwritten `:root`, so anything
`html.light` omits comes through dark.

### Where the tokens live

`src/shared/theme.css` is the full set. A content script's stylesheet cannot
`@import` a `chrome-extension://` URL reliably, so `content.css` carries a hand-synced
copy of every token on-page UI draws with, and a value changed in one file has to be
changed in the other. Those are the dock's ten:

```css
--bb-sep-color  --bb-surface  --bb-border  --bb-text  --bb-hover
--bb-track-off  --bb-track-on --bb-thumb   --bb-shadow --bb-focus
```

and, since the save popover (T-014) and the radius scale (B-019), after the blank line in
each block:

```css
--bb-surface-2  --bb-surface-3  --bb-text-2  --bb-text-3
--bb-accent     --bb-danger     --bb-radius  --bb-radius-lg  --bb-radius-pill
--bb-gap-sm     --bb-gap-md
```

Centre a fixed element with `left: 0; right: 0; width: fit-content; margin: 0 auto`,
not `left: 50%` and a transform. A box at `left: 50%` can only be as wide as the half
of the viewport to its right: the save toast wrapped at 375px, at 188px wide.

`--bb-thumb`, `--bb-focus`, the three radii and `--bb-gap-sm/md` are declared only
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

## Corner radius

**Nothing BibleBoost draws is a square box.** bible.com rounds everything it floats, so a
square card beside its menu looks bolted on. That was B-019, reported by the user. Every
corner comes from one of three tokens:

| Token | Value | For | bible.com's own |
|---|---|---|---|
| `--bb-radius` | 4px | A control: field, button, list option, close button | Reader settings' size and font options, 4px |
| `--bb-radius-lg` | 16px | A floating surface: popover, toast, hint, side panel | Account menu and the menu's inset card, 16px |
| `--bb-radius-pill` | 999px | A pill: dock, switch track and knob, chip, panel tab, tag chip | Buttons and the search field, 9999px |

bible.com's settings popover and its verse menu on a wide window are 24px. 16px everywhere
was the user's choice, with no breakpoint. The measurements are in
`../bible-com/05-theme-and-page-chrome.md`.

1. **Never a literal.** A `border-radius` reads a token, with its fallback, as every
   `var()` does. The check is
   `grep -nE "border-radius:\s*[0-9]" content.css src/ui/*.html`, which must find nothing.
2. **A surface inside a surface takes what it holds plus its padding.** The save popover's
   list is 4px options inside 4px of padding, so it is
   `calc(var(--bb-radius, 4px) + var(--bb-gap-sm, 4px))`, which is 8px. The same arithmetic
   is why 16px suits the popover: 12px of padding and 4px fields. Do not add a fourth token
   for a nested surface.
3. **A surface fixed to the window's edge rounds only the side that faces the page.**
   `#bb-panel` is fixed to the right and rounds its top-left and bottom-left only, as
   `#bb-panel-tab` already did, and as bible.com's verse menu does against the bottom. The
   border goes on every side that is rounded, since a single border tapers to nothing round
   a curve.
4. **Clip what is inside.** A radius rounds a box's own border and background, not its
   children. `#bb-panel` needs `overflow: hidden` to round its iframe.
5. **Inside the panel frame, round controls but never `body`.** The host's `#bb-panel`
   already clips the frame, so a radius on `body` would only draw a second curve inside the
   first.

**The popup** keeps its own unprefixed names, `--radius` and `--radius-pill`, at the same
values. It has no `--bb-radius-lg` counterpart because it draws no floating surface: Chrome
draws its window. Its `.brand img` keeps a literal 5px, the one exception, because that
rounds the app icon's artwork rather than a surface.

## The panel's width

`--bb-panel-width` is the share of the window the user chose (T-019). Nothing
draws with it directly. `content.css` turns it into `--bb-panel-w`,
`clamp(280px, var(--bb-panel-width, 30%), 50%)`, and the panel's width, the tab's
`right`, the grip's `right` and the pinned squeeze on `body` all read that. The
clamp lives in CSS so that a stored width stays within bounds as the window is
resized, with no script running.

**A `var()` inside a custom property is resolved where that property is
declared.** So `--bb-panel-w` is declared on each of the four elements that use it,
not once on `<html>`. Declared on `<html>`, it would be worked out there once, and
the elements below would inherit the result. They would then ignore the
`--bb-panel-width` a drag writes on the panel, tab and grip themselves, which is
how a drag previews without reflowing the page. A percentage inside it, on the
other hand, is kept as a percentage and resolved by the property that uses it. That
is why `body`'s padding and the fixed panel's width, both taken of the same
1385px at 1400x900, still meet.

**The dock moves clear of the open panel** (B-022). The dock is fixed 20px from the
window's bottom-right corner and sits above the panel (T-017 R7), so until B-022 it
covered the panel's corner: its last row, an open note's Save, the toast's Undo.
From 768px, `body:has(> #bb-panel:not([hidden])) > #bb-dock` sets its `right` to
`calc(var(--bb-panel-w, 30%) + 20px)`, inheriting `body`'s `--bb-panel-w`. Measured
with the real `content.css` at 1400px on 2026-11-12: 20px left of the panel at 30%
and at 45%, and back in the corner with the panel hidden. It does not follow a drag's
preview width, only the committed one. Anything new pinned to the window's
bottom-right has the same problem with the panel.

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

   **The exception is a fixed-height row**, such as the note list's (T-021). It is
   virtual above 200 rows and places each row at its index times one height, so
   every row has to be the same height. With `normal`, a line's height follows the
   font that draws it, and a Tamil line is documented as taller than a Latin one
   (`../bible-com/07-i18n-and-scripts.md`). So `ui.css` gives the list a length,
   20px for 13px text. In the built-in browser on 2026-11-11, Tamil and Latin at
   13px in the panel's font stack both measured a 17.33px `normal` line, and
   nothing was clipped at 20px, either at 1024px or with the panel at 280px. The
   user's hand test in their own Chrome on Windows confirmed it on 2026-11-12: a
   long Tamil note clamped to two clean lines at 280px. If a script does clip one
   day, raise `--bb-row-line` and leave `normal` alone.
   **One row may be taller: the open one** (T-022). It holds the editor, takes
   `height: auto` under `[data-bb-open]`, and `list.js` measures it and moves every
   row after it down by the difference. Its editor goes back to `line-height:
   normal`, since it has no height to keep.

   **Anything new in a row goes inline, inside the clamp.** A note's title (T-022
   R11) is a bold `<strong>` at the start of the preview, not a line of its own,
   which would have made every row 98px instead of 78px.
6. **Nothing inside a list row may float out of it.** A row clips what overflows,
   and the list scrolls, which clips it again. So the editor's suggestion list is in
   the flow under its field and the row grows while it is open, and the panel's
   toasts are in the flow under the list, which shortens the list rather than
   covering its last row (T-022 R6). The toast region is never `display: none`: it is
   the live region, and has to exist before a toast is put in it to be announced.
7. **A filled danger button needs two label colours.** White on light
   `--bb-danger` (4.60:1), `#121212` on dark (5.38:1), so `ui.css` sets the dark one
   under both `html.dark` and the OS-dark media query with `:root:not(.light)`.
8. **Honour `prefers-reduced-motion`**, and put it last in the file as
   `content.css` does.
9. **Measure contrast, and record it in a comment.** `--bb-track-on` deliberately
   departs from bible.com's own switch colour because the site's dark-mode "on"
   state measures 1.55:1 against its "off" state at this size.

## Comment style

CSS comments here are as substantial as the JS ones, with the same section
banners (`/* ---------- Verse separators ---------- */`) and the same habit of
recording measured values and layout reasoning. Keep it up.
