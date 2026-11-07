# T-020 — Theme relay into the iframe

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Not started |
| Depends on | T-017 |
| Blocks | — |
| Size | S |
| Risk | Low, but contains a trap |

## Why

bible.com sets `html.light` or `html.dark` **independently of the OS**. A user
can run dark bible.com on a light OS. An iframe is a separate document and cannot
see the parent's class, so the panel would follow the OS and clash with the page.

**The trap:** the existing MutationObserver watches `document.body`. The theme
class is on `<html>`, which is *not* inside body — so the existing observer
**never sees a theme change**. Pure CSS handles it today, which is why nobody has
noticed. Any JS that needs the theme must add its own observer.

## Scope

**In:** detecting the page theme in JS, relaying it, applying it in the panel.

**Out:** the token values themselves (T-006).

## Requirements

**R1.** Add a **separate, small** MutationObserver in `panel-host.js`:

```js
new MutationObserver(onTheme)
  .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
```

Do **not** widen the existing body observer to cover `html` — that would put
every theme change through `align()` for no reason.

**R2.** Resolve the theme in this order: `html.dark` → dark; `html.light` →
light; otherwise `prefers-color-scheme`. bible.com may not have set a class yet
at first paint.

**R3.** Post `{ bb: 'theme', theme: 'dark' | 'light' }` to the iframe on open and
on every change. The panel sets `data-theme` (or the matching class) on its own
`documentElement`.

**R4.** Send the theme **before or with** the first render, so the panel never
flashes the wrong palette. Pass it as a URL hash on the iframe `src` as well as
by message, so the very first paint is already correct.

**R5.** The panel's stylesheet also honours `prefers-color-scheme` as a fallback,
so it is readable even if the relay fails entirely.

**R6.** Check `event.origin` on both sides. Ignore anything that is not the
extension origin, and anything without the `bb:` prefix.

**R7.** Also relay to any **native side panel** instance when T-050 lands. Build
the relay as a function with a list of targets, not a single `postMessage` call
hardcoded to the iframe.

## Files

- `src/content/panel-host.js` — the observer and the relay
- `src/ui/panel.js` — receive and apply
- `src/ui/panel.html` — read the hash on first paint
- `src/shared/theme.css`

## Reference

- `work/understandings/bible-com/05-theme-and-page-chrome.md` — **the trap**, and
  why `html.light` / `html.dark` beat `:root`
- `work/understandings/extension/03-messaging.md` — the host/panel message table
  and the origin rule
- `work/understandings/conventions/02-css-and-theming.md` — the four theme layers

## Acceptance

- [ ] Panel open, switching bible.com to dark: the panel follows immediately
- [ ] Switching back to light: it follows
- [ ] Dark bible.com on a light OS: the panel is dark, not light
- [ ] Opening the panel on an already-dark page shows **no flash** of light
- [ ] With the relay deliberately disabled, the panel still renders readably from
      `prefers-color-scheme`
- [ ] A `postMessage` from a non-extension origin is ignored
- [ ] With `DEBUG_SCHEDULE = true`, a theme change does **not** trigger
      `schedule()`

## Notes

The last acceptance item confirms you added a separate observer rather than
widening the existing one. Both approaches "work"; only one of them is cheap.
