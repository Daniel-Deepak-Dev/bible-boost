# B-018 — Nothing tests that retag() leaves a note's tags sorted

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Done |
| Type | Found by the review of T-005 and T-007 |
| Blocks release | No |
| Depends on | T-005 |
| Size | S |
| Risk | Low |

## The problem

`retag` in `src/shared/schema.js` is what tag rename, merge and delete all go through,
and it ends by sorting:

```js
return [...new Set(kept)].sort(compareText);
```

`02-storage-model.md` requires a note's `tags` to be stored sorted. Every case in
`test/schema.test.js` used a target that already sorts after the tags that survive
(`trust` after `hope`, `z` after `c`), so pushing the target on the end happened to
produce sorted output with or without the sort. The review removed `.sort(compareText)`
in a scratch copy and all 231 tests still passed.

## Scope

**In:** a test that fails when the sort is removed.

**Out:** `db.js` and `mutate()`, which do not run under Node by design.

## Requirements

**R1.** A `retag` case whose target sorts **before** a surviving tag.

**R2.** The case is checked against the bug it is for: with the sort removed it fails.

## Files

- `test/schema.test.js`

## Reference

- `work/understandings/extension/02-storage-model.md`

## Acceptance

- [x] The new case passes
- [x] With `.sort(compareText)` removed from `retag`, it fails
- [x] `node --test` passes

## Notes

Checked on 2026-11-10. In a scratch copy with the sort removed, "retag leaves the tags
sorted when the target sorts before a survivor" failed, 231 passing and 1 failing, and
nothing else did. `node --test` passes on the real tree, 232 of 232.
