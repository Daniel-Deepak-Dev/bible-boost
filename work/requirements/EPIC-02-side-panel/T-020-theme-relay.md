# T-020 — Theme relay into the iframe

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Done |
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
on every change. The panel sets the matching `light` or `dark` class on its own
`documentElement`. It has to be the class: `src/shared/theme.css` matches only
`html.light` / `html.dark`, so a `data-theme` attribute would leave the panel
following the OS.

**R4.** Send the theme **before or with** the first render, so the panel never
flashes the wrong palette. Pass it as a URL hash on the iframe `src` as well as
by message, so the very first paint is already correct.

**R5.** The panel's stylesheet also honours `prefers-color-scheme` as a fallback,
so it is readable even if the relay fails entirely.

**R6.** Check `event.origin` on both sides, as T-017 set it up: the host accepts only
the extension origin, and the panel only `https://www.bible.com` from `window.parent`,
because a content script posts with the page's origin (`03-messaging.md`). Ignore
anything without the `bb:` prefix.

**R7.** Also relay to any **native side panel** instance when T-050 lands. Build
the relay as a function with a list of targets, not a single `postMessage` call
hardcoded to the iframe.

> **Amended 2026-11-11.** T-050 R8 says the native panel follows the *browser's*
> theme, because it sits outside the page, and T-050 R4 gives it its page context
> through `storage.local`, not through this relay. The two requirements disagreed.
> The relay is built as R7 asks, `relayTheme()` over `THEME_TARGETS`, and the list
> holds one target, the frame. T-050 decides whether the native panel ever joins it.

## Files

- `src/content/panel-host.js` — the observer and the relay
- `src/ui/panel.js` — receive and apply
- `src/ui/panel.html` — read the hash on first paint
- `src/ui/theme-boot.js` — new: the classic script that does the reading
- `src/shared/theme.css` — a `color-scheme` block, so the panel's scrollbar follows

## Reference

- `work/understandings/bible-com/05-theme-and-page-chrome.md` — **the trap**, and
  why `html.light` / `html.dark` beat `:root`
- `work/understandings/extension/03-messaging.md` — the host/panel message table
  and the origin rule
- `work/understandings/conventions/02-css-and-theming.md` — the four theme layers

## Acceptance

- [x] Panel open, switching bible.com to dark: the panel follows immediately
- [x] Switching back to light: it follows
- [x] Dark bible.com on a light OS: the panel is dark, not light
- [x] Opening the panel on an already-dark page shows **no flash** of light
- [x] With the relay deliberately disabled, the panel still renders readably from
      `prefers-color-scheme`
- [x] A `postMessage` from an origin that side does not expect is ignored
- [x] With `DEBUG_SCHEDULE = true`, a theme change does **not** trigger
      `schedule()`

## Test it by hand

1. **Load the change.** `chrome://extensions` → BibleBoost → the reload arrow, then
   reload every bible.com tab that was open.
2. **Starting state.** A maximised window on
   `https://www.bible.com/bible/339/EXO.13.TAOVBSI?parallel=114`. Windows in light
   mode (Settings → Personalization → Colors → Choose your mode → **Light**).
   bible.com in light: the round account button at the top right → **Appearance →
   Light**. Click the slim **B** tab on the right edge: the panel opens, light grey.
3. Account button → **Appearance → Dark**. The page goes dark and the panel turns
   dark grey with white text at the same moment, without being reopened.
   → Acceptance: Panel open, switching bible.com to dark: the panel follows immediately
4. **Appearance → Light**. The panel turns light again.
   → Acceptance: Switching back to light: it follows
5. **Appearance → Dark** again, with Windows still light. The panel is dark, not
   light. → Acceptance: Dark bible.com on a light OS: the panel is dark, not light
6. Click the panel's **×**, press **F5** to reload, then click the **B** tab and
   watch the panel appear. It is dark from its very first frame, with no white
   blink. Do it twice.
   → Acceptance: Opening the panel on an already-dark page shows **no flash** of light
7. Right-click inside the panel → **Inspect**. In that Console, which is now the
   panel's own, run `document.documentElement.classList.remove('light', 'dark')`.
   The panel turns light, following Windows, and stays readable: dark text on light
   grey. Switch Windows to **Dark**: the panel turns dark. Switch Windows back to
   Light and press **F5**.
   → Acceptance: With the relay deliberately disabled, the panel still renders readably from `prefers-color-scheme`
8. Set bible.com to **Dark** and open the panel. In the panel's Console run
   `window.postMessage({ bb: 'theme', theme: 'light' }, '*')`: the panel stays dark,
   because that message did not come from the page around it. Then switch the
   Console's context dropdown (top left) to **top** and run
   `window.postMessage({ bb: 'close' }, '*')`: the panel stays open, because only the
   panel itself may close it.
   → Acceptance: A `postMessage` from an origin that side does not expect is ignored
9. In the repository, `content.js` line 516: change `const DEBUG_SCHEDULE = false;`
   to `true`, save, and redo step 1. Open the panel, open DevTools → **Console**
   (context **top**), and clear it. Run
   `document.documentElement.classList.replace('dark', 'light')`, then
   `document.documentElement.classList.replace('light', 'dark')`. The panel follows
   both, and no `[BibleBoost] schedule:` line appears. The console stands in for the
   account menu here because opening that menu adds bible.com's own DOM, which logs
   lines of its own. Set `DEBUG_SCHEDULE` back to `false` and redo step 1.
   → Acceptance: With `DEBUG_SCHEDULE = true`, a theme change does **not** trigger `schedule()`
10. **Standing regression** on `/bible/339/EXO.13.TAOVBSI?parallel=114`: verses
    align, separators draw, `Alt+P` / `Alt+A` / `Alt+S` work, and changing the
    reader's "Aa" size re-aligns.

On a failure, send the step number and what you saw instead, a screenshot, and
anything red in the Console (the page's **top** context, or the panel's own).

## Notes

**Checked by hand by the user, 2026-11-11.** They reported that every step of
*Test it by hand* worked, standing regression included, and every box above is
ticked on that report.

**Built 2026-11-11, alongside T-019 and T-021.** No box was ticked at build time:
every one names the live panel, and that is the user's Chrome.

- `panel-host.js` resolves the theme in R2's order (`pageTheme()`) and relays it
  through `relayTheme()` over `THEME_TARGETS` (R7, amended above). Its observer is
  created in `buildPanel()`, so a page where the panel is never opened pays nothing
  for it, and a listener on `prefers-color-scheme` covers a page with no class at
  all. A class write that leaves the theme alone posts nothing.
- The frame's address is `panel.html#theme=dark` (R4), rewritten before a
  re-append reloads the frame. `theme-boot.js` reads it from `<head>` as a classic,
  blocking script: an extension page refuses inline script, and a module runs
  deferred, possibly after the first paint.
- The panel takes only `'light'` or `'dark'`, and sets the class, which is what
  `theme.css` matches (R3). `theme.css` gained a `color-scheme` block so the
  scrollbar follows the theme too, deliberately not copied into `content.css`.

**Checked through a stand-in on 2026-11-11** (the real `panel-host.js`,
`content.js` and panel on two localhost origins; the recipe is in
`03-task-workflow.md`). The panel followed dark → light → dark with **no**
`schedule()` call. With a light OS emulated, a dark page kept the panel dark, and
removing the page's class made it follow the OS. A message the frame posted to
itself was ignored, as were `close` posted by the page and `theme: 'purple'`. With
no hash and no relay, the panel followed the emulated OS both ways. A stand-in
cannot show the first-paint flash in a real extension frame, which is step 6.

The last acceptance item confirms you added a separate observer rather than
widening the existing one. Both approaches "work"; only one of them is cheap.
