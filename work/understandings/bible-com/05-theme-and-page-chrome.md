# bible.com — theme and page chrome

Confidence: **verified**.

## Theme detection

bible.com sets `html.light` or `html.dark` on the **documentElement**,
**independently of the OS setting**. A user can run dark bible.com on a light OS.

The extension does **no JS theme detection** today. It reacts in CSS only:

```css
:root            { /* light defaults */ }
@media (prefers-color-scheme: dark) { :root { /* OS dark, page class absent */ } }
html.light       { /* page says light */ }
html.dark        { /* page says dark  */ }
```

`html.light` / `html.dark` have specificity (0,1,1) and beat `:root` (0,1,0)
regardless of source order.

### The trap for any new JS surface

**The existing MutationObserver watches `document.body`.** The theme class lives
on `<html>`, which is *not* inside body — so the existing observer **never sees a
theme change**. CSS handles it today, which is why nobody noticed.

Anything that needs the theme in JS (an iframe panel, a canvas, a stored
preference) must add its **own** small observer:

```js
new MutationObserver(onThemeChange)
  .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
```

## Fallbacks are mandatory

An **undefined** CSS custom property invalidates its declaration at
computed-value time. For a gradient-drawn hairline that means the rule vanishes
**silently**. Always write `var(--bb-x, <fallback>)`.

## Bottom chrome

bible.com publishes its own custom properties for its bottom bars:

| Property | Measured values |
|---|---|
| `--tabbar-h` | 72px at phone widths, 95px at 800px, 0px by 1010px |
| `--audio-bar-h` | 80px while the audio player is open, 0px otherwise (from bible.com's stylesheet) |

Anything fixed to the bottom-right must respect both, as `content.css` does:

```css
bottom: calc(24px + var(--tabbar-h, 0px) + var(--audio-bar-h, 0px));
```

At phone width the dock additionally clamps to `max(96px, ...)`.

Their stylesheet writes `--tabbar-h` as `calc(72px + env(safe-area-inset-bottom,0px))`,
and the same with 95px, so on a phone with a home indicator it is more than the table
says. Read it, never hardcode it.

**There is no published height for the top chrome.** On 2026-11-10 every stylesheet of
`/bible/339/EXO.13.TAOVBSI?parallel=114` was scanned for a custom property naming a
height, header, tab bar or nav, and these two bars were the only ones. Clearing the
header would mean measuring it, so the panel simply starts at `top: 0` (T-017).

## Content-Security-Policy

Read from a reader page's response header on 2026-11-10. `frame-src` lists `'self'`,
the bible.com and YouVersion hosts, TrustArc, YouTube, a video host and SoundCloud, and
no `chrome-extension:`. `style-src` is hashes with no `'unsafe-inline'`, while
`style-src-attr` allows inline style attributes. For what `frame-src` means for the
panel's iframe, see `../extension/05-mv3-constraints.md`.

## Fonts

The page font stack is `aktiv-grotesk, system-ui, 'Segoe UI', Arial, sans-serif`,
and scripture is set in a serif. The extension **borrows the page's stack**
rather than bundling a font — commit `a356301` deleted a bundled Inter for this
reason. Bundling a font would also force a `web_accessible_resources` entry.

Use `line-height: normal` on anything showing text at small sizes; the dock
clipped descenders until this was fixed.

## Keyboard

**Verified 2026-11-08** on `/bible/339/EXO.13.TAOVBSI`, in the Claude desktop
app's built-in browser with no extension loaded. With focus on the reader
(`<main>`), real `Alt+P`, `Alt+A` and `Alt+S` key presses reached a `window`
capture-phase listener, a `document` bubble-phase listener and a `window`
bubble-phase listener. Every one had `defaultPrevented: false` and
`ctrlKey: false`. bible.com does **not** swallow these keys, so the plain
bubble-phase `document` listener in `content.js` is enough. Do not move it to the
capture phase to "fix" a shortcut that seems dead.

If the shortcuts do nothing while the dock switches work, the key press most
likely never reached the page. Both of these suspects are **unconfirmed**:

- **Focus is elsewhere**, for example in DevTools after using the console, or in
  the address bar. Click the chapter text first.
- **AltGr.** On keyboard layouts that have an AltGr key, Windows reports right
  Alt as Ctrl+Alt. The handler deliberately returns early when `e.ctrlKey` is
  set, so use the **left** Alt.

This happened for real on 2026-11-08 (B-006). Neither the page listener nor
`chrome.commands` responded to `Alt+P/A/S`, which suggests the key press never
reached Chrome, or the commands were never assigned. Either way it is **not
bible.com**. The cause is still open; B-006 lists the next checks.

## A deliberate colour departure

`--bb-track-on` uses the extension's red rather than bible.com's own switch
colour, because bible.com's dark-mode "on" state measures only **1.55:1** against
its "off" state at this size. Do not "fix" this back to match the site.
