# bible.com — columns and version identity

Confidence: **verified**.

## Finding the columns

bible.com tags each reader column with a `vidNNN` class, but **inconsistently**:

| Column | Actual class |
|---|---|
| parallel (right) | `version vid59 iso6393eng` |
| primary (left) | `cat7xG_vid111` — hashed, **no** `version` class |

So match the vid token itself, never either wrapper:

```js
const VID_RE = /(?:^|[\s_])vid(\d+)(?:\s|$)/;
document.querySelectorAll('div[class*="vid"]')   // then filter by VID_RE
```

`columnEls()` then keeps the **innermost** matching wrapper and de-duplicates by
vid, so there is exactly one element per version.

## Visibility

```js
cols.filter((c) => c.getClientRects().length)   // display:none -> no rects
```

bible.com **hides the second column on narrow screens**. `columns()` returns null
unless exactly two are visible. Any parallel-dependent feature must treat
"parallel is in the URL" and "two columns are on screen" as different facts.

## Language code, free

The `iso6393eng` token is an **ISO 639-3 language code**. Worth capturing on a
saved verse: it tells you the script without guessing from the text.

```js
const LANG_RE = /(?:^|[\s_])iso6393([a-z]{3})(?:\s|$)/;
```

## Resolving a version abbreviation

The URL carries the abbreviation for the **primary column only**. Resolution
order for either column:

1. URL path third segment: `EXO.13.TAOVBSI` gives TAOVBSI. Primary only.
2. The column header chip text — the version button above each column. Works for
   both. **Exact selector unverified — inspect before coding.**
3. The VERSIONS table (currently `popup.js:13`, to be promoted to
   `src/shared/refs.js`).
4. Fall back to the raw numeric id. Never fail a save over a missing abbr.

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
