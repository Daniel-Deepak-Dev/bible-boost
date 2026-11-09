# bible.com — columns and version identity

Confidence: **verified**.

## Finding the columns

bible.com tags each reader column with a `vidNNN` class, in **two shapes**:

| Actual class | Seen on |
|---|---|
| `version vid59 iso6393eng` | ESV, NKJV, TAOVBSI, AMP |
| `cat7xG_vid111` — hashed, **no** `version` class, **no** `iso6393` token | NIV |

So match the vid token itself, never either wrapper:

```js
const VID_RE = /(?:^|[\s_])vid(\d+)(?:\s|$)/;
document.querySelectorAll('div[class*="vid"]')   // then filter by VID_RE
```

The filter is not optional: the substring query also matches Tailwind's
`divide-y-small` on unrelated `div`s.

`BB.dom.columnEls()` (`src/content/bible-dom.js`, moved out of `content.js` in
T-001) then keeps the **innermost** matching wrapper and de-duplicates by vid, so
there is exactly one element per version.

**The shape follows the version, not the position.** This file used to say the
hashed shape marked the primary column. Measured on 2026-11-09, with
`columnEls()`'s own query:

| Page | Left | Right |
|---|---|---|
| `/bible/339/EXO.13.TAOVBSI?parallel=114` | `version vid339 iso6393tam` | `version vid114 iso6393eng` |
| `/bible/111/JHN.1?parallel=114` | `cat7xG_vid111` | `version vid114 iso6393eng` |
| `/bible/114/JHN.1.NKJV?parallel=111` | `version vid114 iso6393eng` | `cat7xG_vid111` |

There is no outer wrapper involved: on those NIV pages `cat7xG_vid111` is the only
element carrying `vid111`. Whether this is NIV alone or a class of versions is not
known, since only a handful of versions have been looked at.

## Visibility

```js
cols.filter((c) => c.getClientRects().length)   // display:none -> no rects
```

bible.com **hides the second column on narrow screens**. `columns()` returns null
unless exactly two are visible. Any parallel-dependent feature must treat
"parallel is in the URL" and "two columns are on screen" as different facts.

At a viewport about 1024px wide it goes further, and bible.com **removes
`?parallel=` from the URL**, leaving one column in the DOM. Seen 2026-11-09 both on
load and on narrowing an open page from 1600px. The width where this starts was not
measured.

## The two columns do not behave alike

Only the **primary** column responds to a tap. The parallel column has the same
markup and the same `cursor: pointer`, but a tap there selects nothing and raises no
menu, in either language order. See `06-verse-action-menu.md`.

## Language code, free

The `iso6393eng` token is an **ISO 639-3 language code**. Worth capturing on a
saved verse: it tells you the script without guessing from the text.

`BB.dom.langOf(col)` in `src/content/bible-dom.js` reads it, with the same token
boundaries as `VID_RE`:

```js
const LANG_RE = /(?:^|[\s_])iso6393([a-z]{3})(?:\s|$)/;
```

It returns `null` when the token is absent: never a default language and never
a throw, so an unrecognised version cannot block a save (T-011 R3, R4).

**Verified 2026-11-08:** on `/bible/339/EXO.13.TAOVBSI?parallel=114`,
`BB.dom.columns().map(BB.dom.langOf)` gave `['tam', 'eng']` in the live page.

**It is `null` for NIV**, whichever column NIV is in, because that shape has no
token (see above). `resolveVersion` leaves the language unknown: the `VERSIONS`
table has no language to offer. It must **never** borrow the other column's code,
which on a Tamil/English pair would label the Tamil verse as English.

**The page does state the language another way, in a different code.** Each column
sits four levels inside a `div` with a `lang` attribute, so `col.closest('[lang]')`
reaches it. Measured 2026-11-09 with `<html lang="en">`:

| Column | `iso6393` token | wrapper `lang` |
|---|---|---|
| TAOVBSI | `tam` | `ta` |
| NKJV | `eng` | `en` |
| NIV | none | `en` |

So the wrapper follows the version, not the interface, and it exists for NIV. But
it is ISO 639-1, two letters, where the token is ISO 639-3, three. T-011 R3 reads
the token only. [B-010](../../requirements/EPIC-08-maintenance/B-010-language-without-iso-token.md)
is whether to use the wrapper for a version with no token.

## Resolving a version abbreviation

`BB.capture.resolveVersion(col)` in `src/content/capture.js`, for either column:

| Step | `source` | Reads | Misses when |
|---|---|---|---|
| 1 | `url` | `parseUrl().abbr`, primary column only | the URL has none, as the popup's URLs do |
| 2 | `link` | a link in `main` naming this column's numeric id | no such link is in the page |
| 3 | `table` | `VERSIONS` in `src/shared/versions.js` | the id is not one the popup offers |
| 4 | `id` | the numeric id as a string | never, and a save never fails over it |

### Why step 2 reads links and not the version chip

The chip was the original plan. It is real and here is its selector, but it is the
weaker source.

In parallel mode at desktop width, `main` holds a docked row with one cell per
column, **outside both columns**:

```
main … div.grid-cols-2
  div                                   ← one per column
    div > button[aria-expanded]         ← the chip; its text is the abbreviation
    a[aria-label="Close NKJV"]          ← the X
```

- **Nothing in the markup ties a chip to its column.** No `href`, no data
  attribute, no vid. Only position does: the chip's left edge equals its column's
  (342 and 910 at a 1600px viewport).
- **On a single-version page the chip has no box.** A copy exists in the DOM at
  width 0.
- Class names here are Tailwind utilities, which `AGENTS.md` rule 5 would have us
  avoid matching anyway.

Links, by contrast, carry the numeric id:

```
/bible/114/EXO.13.NKJV                     aria-label="Close TAOVBSI"
/bible/339/EXO.13.TAOVBSI                  aria-label="Close NKJV"
/bible/339/EXO.12.TAOVBSI?parallel=114     aria-label="Previous Chapter"
/bible/339/EXO.14.TAOVBSI?parallel=114     aria-label="Next Chapter"
```

**The X names the other version**, since closing TAOVBSI leaves you on NKJV. So on
a parallel page the second version's abbreviation appears in exactly one link, the
X on the first chip. The `aria-label` is not read: it is interface text, and it
describes the chip rather than the target.

Percent-encoding is real. Version 48's link is `CUNPSS-%E7%A5%9E` and its chip
reads `CUNPSS-神`, so `parseUrl` decodes.

One thing not established: on `/bible/339/EXO.13.TAOVBSI?parallel=48` both chips
rendered, but no element carried `vid48`, after 3 seconds on a full load and 6 on
client-side navigation. `resolveVersion` is only ever given a column that exists,
so this does not affect it. Whether that version renders a second column at all
was not looked into.

## Known version ids

| id | abbr |
|---|---|
| 1 | KJV |
| 59 | ESV |
| 100 | NASB1995 |
| 111 | NIV |
| 114 | NKJV |
| 116 | NLT |
| 339 | TAOVBSI (Tamil O.V., BSI) |

This list is **not exhaustive** — it is only what the popup offers. A user can be
reading any version id. Always handle an unknown id gracefully.

## Column order

`const [A, B] = cols.map(firstSpans)` is **DOM order**, not primary/parallel
order. If you need to know which is which, compare each column's vid against
`parseUrl().id`. Do not assume A is primary.
