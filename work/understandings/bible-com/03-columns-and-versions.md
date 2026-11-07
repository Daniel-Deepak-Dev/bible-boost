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

`BB.dom.columnEls()` (`src/content/bible-dom.js`, moved out of `content.js` in
T-001) then keeps the **innermost** matching wrapper and de-duplicates by vid, so
there is exactly one element per version.

**Re-checked 2026-11-08** on `/bible/339/EXO.13.TAOVBSI?parallel=114`. The two
elements `columns()` returned had **identical** class shapes:

```
version vid339 iso6393tam    ← primary (left), TAOVBSI
version vid114 iso6393eng    ← parallel (right), NKJV
```

So on that page the primary column *does* have the plain `version` class. The
`cat7xG_vid111` row above was recorded earlier, with NIV as the primary. Either
it is an outer wrapper that `columnEls()` now steps past to an inner `version`
element, or bible.com has changed its build since then. Which one is not yet
known. Either way the rule stands: match the vid token, never a wrapper class.
The comment above `VID_RE` in `bible-dom.js` still describes the older
observation; it was moved verbatim in T-001, so it was deliberately left unchanged.

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

`BB.dom.langOf(col)` in `src/content/bible-dom.js` reads it, with the same token
boundaries as `VID_RE`:

```js
const LANG_RE = /(?:^|[\s_])iso6393([a-z]{3})(?:\s|$)/;
```

It returns `null` when the token is absent: never a default language and never
a throw, so an unrecognised version cannot block a save (T-011 R3, R4).

**Verified 2026-11-08:** both columns carry the token. On
`/bible/339/EXO.13.TAOVBSI?parallel=114`, `BB.dom.columns().map(BB.dom.langOf)`
gave `['tam', 'eng']` in the live page (see the classes recorded above).

If a column ever comes back `null`, T-011 must fall back to the version table
or leave the language unknown. It must **never** borrow the other column's
code, which on a Tamil/English pair would label the Tamil verse as English.

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
