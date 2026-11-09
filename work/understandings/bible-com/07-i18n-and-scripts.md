# Multilingual and non-Latin script handling

Confidence: **verified** for the measurement findings; **design guidance** for
the search and export rules.

The primary user reads Tamil (TAOVBSI) alongside English (NKJV). Every feature
must work in both. Treat Latin-only assumptions as bugs.

## Localized book names live only in the page

The codebase has **no** USFM-to-name table and no `_locales/`. The Tamil name for
Exodus exists only in bible.com's own DOM — in the chapter heading and in the
action menu header.

**Rule:** store `usfm` as the key, and capture the localized string separately as
`displayRef` for display only. Never parse a localized name to derive a book.

## Script metrics differ, and it broke alignment

A Tamil line box is **taller** than a Latin one at the same font size. Two
consequences, both measured:

1. `0.6em` is not the same number of pixels in a Tamil column as in a Latin one.
   This is why spacing must be applied **before** the measuring pass — so the
   measurement absorbs the difference instead of fighting it.
2. The verse label sits at a different offset inside its line box, so the two
   columns' separator hairlines landed about **9px apart on 16 of 18 rows of
   Exodus 13**. `levelRules()` exists solely to correct this.

**If you add anything that aligns across columns, assume the two scripts have
different metrics and measure rather than calculate.**

## Search normalization rules

```js
s.normalize('NFC').toLocaleLowerCase()
```

`src/shared/normalize.js` implements these (T-007).

- **Normalize to NFC.** The same Tamil string can arrive composed or decomposed;
  without normalizing, a visually identical query will not match. Exactly four
  Tamil code points decompose, found by scanning U+0B80–U+0BFF in Node during
  T-007: U+0BCA (U+0BC6 U+0BBE), U+0BCB (U+0BC7 U+0BBE), U+0BCC (U+0BC6 U+0BD7)
  and U+0B94 (U+0B92 U+0BD7).
- **Use `toLocaleLowerCase()`**, not `toLowerCase()`. It follows the machine's
  locale: under Turkish, `I` becomes dotless `ı` (U+0131). A test asserting an
  English fold should therefore use a word with no `I`.
- **Tokenize on Unicode classes**: `/[\s\p{P}\p{S}]+/u`. `\p{S}` is there because
  `+` and `=` are symbols, not punctuation.
- **Never use `\b`.** Word boundaries are defined on Latin word characters and do
  not work for Tamil.
- **No stemming, and no Lunr / FlexSearch / elasticlunr.** Their default
  tokenizers and stemmers are English-centric and will mangle Tamil.
- **Always keep a substring fallback pass** for short queries and for cases where
  token matching returns nothing. For non-Latin scripts this is not a nicety — it
  is often the only thing that matches.

## Export rules

- **CSV must be written UTF-8 with a BOM** (`﻿` prefix). Without it, Excel
  on Windows opens the file in the system ANSI codepage and renders Tamil as
  mojibake. This is the single most likely export bug.
- JSON and Markdown need no BOM.
- When writing files from PowerShell, `Set-Content` / `Add-Content` default to
  ANSI; pass `-Encoding utf8` explicitly.

## Sorting

Do **not** sort note titles or tags with a plain `<` comparison. Use
`Intl.Collator` so mixed-script lists order sensibly:

```js
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
```

Verse ordering is a different problem: sort by **canonical book index**, then
chapter, then verse — never alphabetically by book code. `compareUsfm` in
`src/shared/refs.js` does this. A book outside the 66 sorts after Revelation, and
a key it cannot parse sorts last.
