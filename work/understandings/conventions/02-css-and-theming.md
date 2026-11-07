# CSS and theming

Confidence: **verified** from `content.css` and `popup.html`.

## Architecture

No preprocessor, no framework, no BEM. Two patterns:

- **On-page CSS** (`content.css`) scopes by id and prefixes every token:
  `#bb-dock .bb-sw`, `--bb-surface`. The prefix prevents collision with
  bible.com.
- **Extension-page CSS** (popup, and now panel/notes) uses short unprefixed
  semantic tokens — `--canvas`, `--surface-2`, `--text-1`, `--border`, `--focus`,
  `--brand` — because nothing else shares the document.

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

The current on-page token set:

```css
--bb-sep-color  --bb-surface  --bb-border  --bb-text  --bb-hover
--bb-track-off  --bb-track-on --bb-thumb   --bb-shadow --bb-focus
```

**Task T-006 extracts this block to `src/shared/theme.css`** so the panel and the
notes page use the same values as the dock.

## Rules

1. **Always give `var()` a fallback.** An undefined custom property invalidates
   the whole declaration at computed-value time — a gradient-drawn hairline
   disappears silently with no error.
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
