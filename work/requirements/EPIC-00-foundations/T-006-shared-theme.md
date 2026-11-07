# T-006 — Shared theme token file

| Field | Value |
|---|---|
| Epic | EPIC-00 Foundations |
| Status | Not started |
| Depends on | — |
| Blocks | T-017, T-025 |
| Size | S |
| Risk | Low |

## Why

Three surfaces will show BibleBoost UI — the dock, the panel iframe and the
notes page — and a fourth already does (the popup). Today the dock's `--bb-*`
tokens live in `content.css` and the popup has its own unprefixed set in an
inline `<style>`. Without a shared file, the panel becomes a third colour system
and they drift.

## Scope

**In:** one token file, consumed by the new surfaces.

**Out:** restyling anything, changing any colour value, refactoring the popup's
existing inline styles beyond pointing them at the shared file.

## Requirements

**R1.** Create `src/shared/theme.css` holding the semantic token block and all
four theme layers, in this order:

```css
:root { /* light */ }
@media (prefers-color-scheme: dark) { :root { /* OS dark, page class absent */ } }
html.light { }
html.dark  { }
```

**R2.** Carry over the existing on-page tokens **unchanged in value**:
`--bb-sep-color`, `--bb-surface`, `--bb-border`, `--bb-text`, `--bb-hover`,
`--bb-track-off`, `--bb-track-on`, `--bb-thumb`, `--bb-shadow`, `--bb-focus`.

**R3.** Add the tokens the notes UI needs, named in the same style:
`--bb-surface-2`, `--bb-surface-3`, `--bb-text-2`, `--bb-text-3`,
`--bb-accent`, `--bb-danger`, `--bb-radius`, `--bb-gap-sm/md`.
Derive the greys from the popup's existing `--surface-2` / `--text-2` values
rather than inventing new ones.

**R4.** Keep the deliberate departure: `--bb-track-on` stays the extension's red,
**not** bible.com's switch colour, because the site's dark-mode "on" state
measures 1.55:1 against its "off" state at this size. Carry the comment over.

**R5.** `content.css` keeps its own copy of the block for now — a content script
CSS file cannot `@import` a `chrome-extension://` URL reliably. Mark both with a
"keep in sync with `src/shared/theme.css`" comment, in the same style as the
existing `DEFAULTS` comment. The panel and notes pages `<link>` the shared file.

**R6.** Every `var()` has a fallback. An undefined custom property invalidates
its declaration at computed-value time and a gradient-drawn hairline vanishes
with no error.

## Files

- `src/shared/theme.css` — new
- `content.css` — add the sync comment
- `popup.html` — optional: `<link>` the shared file and drop duplicated values

## Reference

- `work/understandings/conventions/02-css-and-theming.md`
- `work/understandings/bible-com/05-theme-and-page-chrome.md` — why `html.light`
  / `html.dark` beat `:root`, and why the popup cannot see them

## Acceptance

- [ ] The dock looks pixel-identical to before, in both bible.com themes
- [ ] A scratch page linking `theme.css` renders the light palette by default and
      the dark palette under `html.dark`
- [ ] Every new token is defined in all four layers, or deliberately inherits
- [ ] No colour value changed from its current one

## Notes

The duplication between `content.css` and `theme.css` is accepted and
commented, not an oversight. If a future change makes a content-script stylesheet
able to share the file, remove the copy then.
