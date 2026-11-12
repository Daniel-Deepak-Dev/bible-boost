# bible.com — theme and page chrome

Confidence: **verified**.

## Theme detection

bible.com sets `html.light` or `html.dark` on the **documentElement**,
**independently of the OS setting**. A user can run dark bible.com on a light OS.

On-page UI does **no JS theme detection**. It reacts in CSS only, below. The one
exception is the panel's frame, which cannot see the class: `panel-host.js` reads it
and relays it (T-020, and the trap below).

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

`panel-host.js` does exactly this, and only once the panel has first been opened.
It compares the resolved theme with the last one it sent and posts nothing when
they match, so a class write on `<html>` that leaves the theme alone costs one
comparison.

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

Reading it from script takes one more step. `getPropertyValue('--tabbar-h')` returned
`calc(72px + 0px)` at 375px and `calc(95px + 0px)` at 760px, because a custom property's
computed value keeps the arithmetic, and `parseFloat` of that is `NaN`. Put the sum on a
real length property and read that one. `#bb-chip` uses `scroll-margin-bottom`, which does
nothing to a fixed element and reads back as `72px` (T-015).

**There is no published height for the top chrome.** On 2026-11-10 every stylesheet of
`/bible/339/EXO.13.TAOVBSI?parallel=114` was scanned for a custom property naming a
height, header, tab bar or nav, and these two bars were the only ones. Clearing the
header would mean measuring it, so the panel simply starts at `top: 0` (T-017).

## Page layout

Measured 2026-11-10 at 1400x900 on `/bible/339/EXO.13.TAOVBSI?parallel=114`, dark, logged
out (T-018). The classes are Tailwind's and describe the page; never select on them.

```
body.bg-canvas
  div.grid  lg:grid-cols-[var(--rail-w)_minmax(0,1fr)]     the app shell
    aside   sticky, 220px (--rail-w), hidden below lg       the left rail
    div     flex-col                                         1165px wide here
      header  sticky top-0, 72px
      main#main
        div.pbe-24
          div  sticky, 57px, from y=72                       the version chips (parallel only)
          div.grid  max-w-container-xl (1200px), md:grid-cols-2, px-10
            the two vid columns, 534px each here
          div  sticky to the bottom                          Previous / Next Chapter
      footer
```

- **The top chrome is 129px here:** the 72px header and the 57px chip row, both sticky.
  Neither height is published (above), so anything that has to clear them, such as the
  panel's reading line, stays well below rather than relying on the number.
- **The header's right side holds bible.com's controls:** Audio at 1078px, Exit Parallel,
  **Settings ("Aa") at 1158px**, Get the app, and Account at 1305–1345px. Anything laid over
  the right of the window covers them.
- **The verse action menu is not in that flow.** Its root is `position: fixed`, from
  `--rail-w` to the window's right edge, and centres a 480px card in it: 562–1042px here.
  Narrowing the page does not move it (B-020).
- `body` has no padding of its own (`0px`) and no inline style. `<html>` carries an inline
  `color-scheme: dark;`. bible.com uses Headless UI, which marks `<html>` with
  `data-headlessui-focus-visible`, and whose dialog scroll lock writes `padding-right` onto
  `<html>`. That last part comes from Headless UI's source, not from seeing it happen here.
- The reader settings popover is `position: absolute`, `z-index: 1500`, under its button.
  Opening it writes nothing onto `body` or `<html>`.

### Narrowing the page

How T-018 makes room for a pinned panel, and why it is `body`:

| Narrowed by 30% | Columns | The rest |
|---|---|---|
| `body`, `padding-right` | 260–587px and 603–929px | the header ends at the panel's 969px |
| `main#main`, `padding-right` | the second ends near 995px, under the panel | header controls stay under the panel |

A percentage is taken of the containing block. On `body` that is the 1385px the window
leaves beside its scrollbar, the same width a fixed element's `width: 30%` is taken of, so
the page and a fixed panel meet exactly. On `main` it is the 1165px beside the rail.

**Chrome's scroll anchoring does not survive it.** Narrowing re-wraps every line, and with
padding on `body`, `<html>` or `main` alike, `scrollY` stayed at 1489 while verse 10 moved
from 152px to 1241px. A change to `padding` on an ancestor of the anchor node is one of the
scroll-anchoring spec's suppression triggers. Taking the padding off again put the verse
back at exactly 152px. Anything that narrows the page has to keep the reader's place
itself, as `panel-host.js` does.

**Switching the extension off does not undo it.** Seen by hand on 2026-11-11, in T-018's
step 13: with the panel pinned, turning BibleBoost off in `chrome://extensions` left the
open tab narrowed until the tab was reloaded. The narrowing needs both the `body` rule in
`content.css` and the `--bb-squeeze` written on `<html>`, so both stayed in the tab, and
nothing of ours ran at the switch to remove either. Only a reload gives back a normal page.
Whether the edge tab and the panel's frame stayed too was not noted.

The reader grid keeps two columns, because its `md:grid-cols-2` follows the window, not the
space it is given. At 375px bible.com dropped `?parallel=` from the URL on its own, as
`03-columns-and-versions.md` describes.

## Content-Security-Policy

Read from a reader page's response header on 2026-11-10. `frame-src` lists `'self'`,
the bible.com and YouVersion hosts, TrustArc, YouTube, a video host and SoundCloud, and
no `chrome-extension:`. `style-src` is hashes with no `'unsafe-inline'`, while
`style-src-attr` allows inline style attributes. For what `frame-src` means for the
panel's iframe, see `../extension/05-mv3-constraints.md`.

## Corner radii

Measured 2026-11-10 with `getComputedStyle` on `/bible/339/EXO.13.TAOVBSI?parallel=114`,
1280x900, dark, logged out, each surface opened by hand (B-019). Radius does not change
with the theme.

| Surface | Radius | Class |
|---|---|---|
| Reader settings popover ("Aa"), 360px wide | 24px | `rounded-24` |
| Account menu popover, 300px wide | 16px | `rounded-16` |
| Version picker popover | 8px | `rounded-8` |
| Verse action menu card | 16px top corners, 24px from 640px, bottom corners square | `rounded-t-16 md:rounded-t-24` |
| The sign-up card inside that menu | 16px | `rounded-16` |
| Sidebar nav items | 12px | `rounded-12` |
| Size and font options in reader settings | 4px | `rounded-4` |
| Buttons, the search field, colour swatches, close buttons | a pill or a circle | `rounded-[9999px]`, `rounded-full` |

So bible.com has a scale, not one radius: 4px for a control, 16px or 24px for anything that
floats, and a pill for buttons. The version picker's 8px is the odd one out.

**An edge-fixed surface rounds only its open side.** The verse menu is fixed to the bottom of
the window, and only its top corners are rounded. At phone width it is as wide as the window,
and its top corners are still rounded where they meet the window's sides.

The popovers' shadow is `0 4px 12px rgba(0, 0, 0, 0.5)` on dark, and the menu card's
`0 2px 6px rgba(0, 0, 0, 0.45)`.

These are Tailwind utility classes. They describe what bible.com does; never select on them.
How the extension uses this is in `../conventions/02-css-and-theming.md`.

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
