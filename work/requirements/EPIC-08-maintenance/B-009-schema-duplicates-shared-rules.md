# B-009 — schema.js keeps its own copy of the verse and text rules

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Duplication |
| Blocks release | No |
| Depends on | T-007 |
| Size | S |
| Risk | Low |

## The problem

Found during [T-007](../EPIC-00-foundations/T-007-test-harness.md), whose Files
list does not include `schema.js`.

T-002 wrote verse and text handling into `src/shared/schema.js` before the modules
meant to own them existed. T-007 added those modules, so three rules now have two
definitions:

| Rule | In `schema.js` | In the shared module |
|---|---|---|
| The shape of a verse key | `USFM_RE` | `USFM_RE` in `refs.js` |
| Taking the part before the `+` | `cleanUsfm` | `parseUsfm` in `refs.js` |
| NFC, then lowercase | `normalizeTag`, `slugify` | `fold` in `normalize.js` |

## Why it matters

They agree today, and each side has its own tests. It matters once one changes:
T-047 parses an imported ref through `refs.js`, and `schema.js` then validates the
same ref on save. If the two disagree, a ref that imports cleanly is refused at
the last step.

## Scope

**In:** `schema.js` importing these rules from `refs.js` and `normalize.js`.

**Out:** changing what either module accepts.

## Requirements

**R1.** `cleanUsfm` uses `parseUsfm`, and still throws its own message, because
`schema.js` reports errors to the user and `parseUsfm` returns `null`.

**R2.** `normalizeTag` and `slugify` use `fold`. `normalizeTag` keeps its `trim()`
and its `''` for a non-string.

**R3.** `USFM_RE` is removed from `schema.js`.

## Acceptance

- [ ] `node --test` passes with `test/schema.test.js` unchanged
- [ ] `grep -n "USFM_RE" src/shared/schema.js` finds nothing
- [ ] `toLocaleLowerCase` appears in `normalize.js` and nowhere else in `src/shared/`

## Notes

Order this against T-037. Once T-037 R8 makes `normalizeText` collapse whitespace,
`fold` will too, and routing `normalizeTag` through it changes how a tag holding
unusual spaces is stored. That may be what is wanted, but it has to be a decision.
