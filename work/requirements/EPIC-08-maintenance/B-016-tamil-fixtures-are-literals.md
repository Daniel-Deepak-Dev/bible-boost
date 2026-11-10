# B-016 — The decomposed Tamil test fixtures are literals, not escapes

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Done |
| Type | Found by the review of T-007 |
| Blocks release | No |
| Depends on | T-007 |
| Size | S |
| Risk | Low |

## The problem

`conventions/01-code-style.md` says decomposed text is written with escapes, and the
comment above the fixtures in `test/normalize.test.js` said they were: "Written as
escapes and never as literals."

They were literals, and had been since the first commit. A dump of the code points
found the decomposed sequences stored raw on six lines, and no `\u0B..` escape in
either file:

| File | Line | Stored |
|---|---|---|
| `test/normalize.test.js` | 20 | `0BAE 0BC7 0BBE 0B9A 0BC7` |
| `test/normalize.test.js` | 37-40 | `0BC6 0BBE`, `0BC7 0BBE`, `0BC6 0BD7`, `0B92 0BD7` |
| `test/schema.test.js` | 82 | `0B95 0BC6 0BBE 0B9F 0BC1` |

The two forms render identically. An editor, a formatter or a paste that normalizes to
NFC would turn each decomposed literal into its composed twin without changing a pixel,
and the tests would go on passing while comparing a string with itself. The `MOSES`
pair and the `schema.test.js` pair each had a `notEqual` guard for that. The four-pair
test, "composes all four Tamil decompositions", had none.

## Scope

**In:** the six lines, and a guard for the four-pair test.

**Out:** the composed fixtures. A composed literal has nothing to lose to
normalization.

## Requirements

**R1.** Every decomposed fixture is written as `\uXXXX` escapes.

**R2.** The four-pair test asserts that each pair really is two different strings.

## Files

- `test/normalize.test.js`
- `test/schema.test.js`

## Reference

- `work/understandings/conventions/01-code-style.md` — "Decomposed text is written with
  escapes"
- `work/understandings/bible-com/07-i18n-and-scripts.md`

## Acceptance

- [x] No line in `test/` differs from its own NFC form
- [x] The four-pair test fails if a decomposed entry is replaced with its composed form
- [x] `node --test` passes

## Notes

Checked on 2026-11-10. A scan of every `.js` file under `test/` found no line that
differs from its NFC form, where it had found six. In a scratch copy the first pair's
decomposed entry was replaced with the composed sign, and "normalizeText composes all
four Tamil decompositions" failed, 231 passing and 1 failing. `node --test` passes, 232
of 232.

The six lines were rewritten by a script that found each one by line number, checked
its code points against the dump first, and wrote the escapes from the characters
already in the file. Typing a decomposed literal into an edit so as to replace it is
the very thing that cannot be trusted to arrive decomposed.
