# B-008 — The dock reads its theme tokens with no fallback

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Pre-existing debt |
| Blocks release | No |
| Depends on | — |
| Size | S |
| Risk | Low |

## The problem

Found during [T-006](../EPIC-00-foundations/T-006-shared-theme.md), whose Files
list limits `content.css` to a comment.

`content.css` reads its `--bb-*` theme tokens with a bare `var()` in 12 places:

| Selector | Property | Token |
|---|---|---|
| `[data-bb-v="sep"]::before` | `background-image` (twice) | `--bb-sep-color` |
| `#bb-dock` | `background` | `--bb-surface` |
| `#bb-dock` | `border` | `--bb-border` |
| `#bb-dock` | `box-shadow` | `--bb-shadow` |
| `#bb-dock` | `color` | `--bb-text` |
| `#bb-dock .bb-sw` | `color` | `--bb-text` |
| `#bb-dock .bb-sw:hover` | `background` | `--bb-hover` |
| `#bb-dock .bb-sw:focus-visible` | `outline` | `--bb-focus` |
| `#bb-dock .bb-track` | `background` | `--bb-track-off` |
| `#bb-dock .bb-thumb` | `background` | `--bb-thumb` |
| `.bb-sw[aria-checked="true"] .bb-track` | `background` | `--bb-track-on` |

The rule in `work/understandings/conventions/02-css-and-theming.md` is to always
give `var()` a fallback, and the Theme tokens comment in `content.css` says
"Fallbacks first, and never omitted". The file's other `var()` calls do have one
(`--bb-gap`, `--bb-sep-rise`, `--tabbar-h`, `--audio-bar-h`).

## Why it matters

It works today, because the tokens are declared in the same file. It matters once
that stops being guaranteed: `content.css` now holds a hand-synced copy of part of
`src/shared/theme.css`, so a token renamed or dropped in one place fails silently.
The separator is the worst case, since an undefined `--bb-sep-color` invalidates
the gradient and the hairline vanishes with no error.

## Scope

**In:** adding a fallback to each read listed above, and making the comment true.

**Out:** changing any token's value, moving the tokens, any other `content.css`
change.

## Requirements

**R1.** Each `var(--bb-x)` listed above becomes `var(--bb-x, <value>)`, where
`<value>` is that token's `:root` declaration in `content.css`.

**R2.** Reword "Fallbacks first, and never omitted" so that it describes what the
file actually does.

## Acceptance

- [ ] `grep -n "var(--bb-[a-z-]*)" content.css` finds nothing
- [ ] The dock looks pixel-identical to before, in both bible.com themes
- [ ] Separators still draw on `/bible/339/EXO.13.TAOVBSI?parallel=114`
- [ ] Deleting `--bb-sep-color` from all four layers in DevTools still draws a
      separator

## Notes

The light `:root` values are a fallback of last resort. On a dark page they would
be the wrong colour, but a visible wrong colour is the better failure here.
