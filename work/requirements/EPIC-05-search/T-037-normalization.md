# T-037 — Script-safe normalization and tokenizing

| Field | Value |
|---|---|
| Epic | EPIC-05 Search |
| Status | Not started |
| Depends on | T-007 |
| Blocks | T-038 |
| Size | S |
| Risk | Medium — wrong here is invisible in English testing |

## Why

Every text comparison in the application funnels through this module: search
indexing, search queries, tag normalization, topic duplicate detection. Getting
it wrong does not produce an error — it produces a system that quietly fails to
match things, and only for the non-Latin half of the content.

This task is pure functions with tests, so it can be done first and
independently.

## Scope

**In:** normalization, case folding, tokenizing — as pure, testable functions.

**Out:** the index (T-036), the fallback (T-038).

## Requirements

**R1.** `src/shared/normalize.js` exports `normalizeText(s)`, `fold(s)` and
`tokenize(s)`. Pure functions, **no `chrome.*` and no DOM** — that is what makes
them runnable under `node --test`, and it is a design constraint on everything in
`src/shared/`.

T-007 shipped all three, with R2 to R7 and R9 in place and every R10 case except
the whitespace one. **What is left here is R8**, then checking the Acceptance list
against the result.

**R2. NFC normalization first.** The same Tamil string can arrive composed or
decomposed depending on the input method and the source. Without normalizing,
two visually identical strings compare unequal.

```js
s.normalize('NFC')
```

**R3. `toLocaleLowerCase()`, never `toLowerCase()`.** They are identical in
English and diverge elsewhere, which is exactly why this gets missed.

**R4. Tokenize on Unicode classes**, not Latin word characters:

```js
s.split(/[\s\p{P}\p{S}]+/u).filter(Boolean)
```

**R5. Never use `\b`.** Word boundaries are defined in terms of Latin word
characters; `\b` does not mean what it appears to mean in Tamil text. Treat any
`\b` in this codebase as a bug.

**R6. No stemming.** English stemmers mangle other scripts, and for a notes
collection of this size the recall gain is not worth the wrongness.

**R7.** Strip combining marks **only** where that is correct for the script. For
Tamil it is **not** — vowel signs are not accents, and removing them changes the
word. If diacritic-insensitive matching is ever wanted, it must be per-script and
opt-in. Default: do not strip.

**R8.** Handle the whitespace the DOM actually produces: ` ` and other
Unicode spaces collapse to a single space.

**R9.** Comment each rule with **why**, in house style. The next reader will
otherwise "simplify" `toLocaleLowerCase` back to `toLowerCase`.

**R10.** `test/normalize.test.js` must include **real Tamil cases**, not only
English:

- a composed and a decomposed form of the same Tamil word fold identically
- a Tamil sentence tokenizes into the expected words
- mixed Tamil and English text tokenizes correctly
- ` ` collapses
- an English case confirming `toLocaleLowerCase` behaves as expected

## Files

- `src/shared/normalize.js` — exists since T-007; gains R8
- `test/normalize.test.js` — exists since T-007; gains the R8 cases

## Reference

- `work/understandings/bible-com/07-i18n-and-scripts.md` — **the normative rules
  for this task**
- `work/understandings/conventions/01-code-style.md` — shared modules stay free
  of browser APIs

## Acceptance

- [ ] `normalizeText` returns NFC output for composed and decomposed input alike
- [ ] A composed and a decomposed Tamil word fold to the same string
- [ ] `tokenize` splits a Tamil sentence into the expected tokens
- [ ] Mixed-script text tokenizes correctly
- [ ] ` ` and runs of whitespace collapse
- [ ] No `\b` appears anywhere in the module
- [ ] Tamil vowel signs are **preserved**, not stripped
- [ ] The module imports nothing browser-specific
- [ ] `node --test test/normalize.test.js` passes

## Notes

Get real Tamil strings for the tests — from a saved note, from the page, from
the understanding file. Transliterated placeholders will pass the tests and prove
nothing.

Open question, measured during T-007: U+200C and U+200D (ZWNJ and ZWJ, `\p{Cf}`)
are neither split on nor stripped, so a word holding one does not match the same
word without it. Check whether real Tamil notes contain them before deciding
whether R8 should remove them.
