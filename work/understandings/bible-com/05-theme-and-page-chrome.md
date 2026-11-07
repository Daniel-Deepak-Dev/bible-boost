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
| `--audio-bar-h` | height of the audio player when open |

Anything fixed to the bottom-right must respect both, as `content.css` does:

```css
bottom: calc(24px + var(--tabbar-h, 0px) + var(--audio-bar-h, 0px));
```

At phone width the dock additionally clamps to `max(96px, ...)`.

## Fonts

The page font stack is `aktiv-grotesk, system-ui, 'Segoe UI', Arial, sans-serif`,
and scripture is set in a serif. The extension **borrows the page's stack**
rather than bundling a font — commit `a356301` deleted a bundled Inter for this
reason. Bundling a font would also force a `web_accessible_resources` entry.

Use `line-height: normal` on anything showing text at small sizes; the dock
clipped descenders until this was fixed.

## A deliberate colour departure

`--bb-track-on` uses the extension's red rather than bible.com's own switch
colour, because bible.com's dark-mode "on" state measures only **1.55:1** against
its "off" state at this size. Do not "fix" this back to match the site.
