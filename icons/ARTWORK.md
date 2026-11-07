# Icon artwork

    STATUS: INTERIM

`tools/package.ps1` refuses to build a store zip while this file says `INTERIM`. Change it to
`FINAL` only once the icons below are the artwork you intend to publish and you hold the rights
to it. The marker exists so placeholder art cannot reach the Chrome Web Store by accident.

## What is here now

`icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` are rendered from this repository's own
hand-drawn sources:

| Output | Source |
|---|---|
| `icon16.png`, `icon32.png` | `v2-svg/bibleboost-small.svg` |
| `icon48.png`, `icon128.png` | `v2-svg/bibleboost.svg` |

Both SVGs are original work. No part of them is copied from another image, and they are safe to
publish from a copyright standpoint.

Re-render after editing either SVG:

    powershell -ExecutionPolicy Bypass -File icons\v2-svg\render-icons.ps1

That writes all four PNGs into `icons/` and fails if any comes out the wrong size.

## Why this is still marked INTERIM

The drawing is original, but its *composition* — a red rounded tile, a cream page edge curling up
at the right, a bookmark at the lower left — is close to the arrangement of the YouVersion Bible
App icon. Copyright and trade dress are different things: redrawing something by hand clears the
first but not the second. Trade dress protects the overall look a product is recognised by, so an
original drawing can still read as an imitation.

This is lower risk than what shipped before v2.3.0, which was literally rendered from YouVersion's
icon (see `../other-resource/icons-archive/NOTE.txt`), but it is not zero.

## Brief for the replacement

Deliver an SVG, or a 1024x1024 PNG on a flat solid background colour so `build-icons.ps1` can key
it out. Art fills 96 of 128 units, with 16 units of transparent padding.

Must not appear — individually arguable, together they are YouVersion's trade dress:

- The words HOLY BIBLE, or any text at all. Text is illegible at 16px regardless.
- The closed-book construction: a cover tile with a separate cream page-block band across the
  bottom and the cover curling over it at the right.
- A small bookmark tab hanging below that page block on the left.
- Their gradient `#C8463E` to `#78272E` on cream `#FDF1E5`.

Free to use, because it is generic to the whole category and not ownable: a rounded-square app
tile, a warm red or burgundy family, a book as the subject, cream as the paper colour.

The design:

- An **open** book, two facing pages, seen straight on or slightly from above. Open rather than
  closed is the structural break from YouVersion, and it also means "two versions side by side",
  which is what the extension does.
- Each page carries three or four short horizontal text rules, cream, with the left page's rules
  aligned row-for-row with the right page's. The gutter reads as the column divide. This alignment
  is the product and must still read at 48px.
- One faint hairline across both pages between two rule rows, for the verse-separator feature.
- One accent only: a small upward chevron or lightning mark in amber. More than one accent turns
  to mush at 16px.
- Palette: a burgundy noticeably deeper or cooler than theirs (`#8E1F2F` or `#7B2238`), cream pages
  `#F7EDE2`, amber accent `#F5A524`.

Acceptance test: view it at 16px. "Two blocks side by side" must still be readable.

If you use an image generator, do not give it the YouVersion icon as a reference image. A
derivative is a derivative however it was produced. Check the output for accidental garbled text.
If you buy stock art, keep the licence receipt: the Chrome Web Store Developer Agreement makes the
publisher warrant they own or are licensed for every asset uploaded.

## Wiring new artwork in

From an SVG, replace `v2-svg/bibleboost.svg` and `v2-svg/bibleboost-small.svg` and re-render as
above. From a raster file:

    powershell -ExecutionPolicy Bypass -File icons\build-icons.ps1 -Source path\to\art.png -OutDir icons

Then confirm the real pixel dimensions of all four PNGs, not just their filenames. A mis-sized
`icon128.png` is a routine rejection.
