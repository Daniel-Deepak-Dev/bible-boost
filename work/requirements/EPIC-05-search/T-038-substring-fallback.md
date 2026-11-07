# T-038 — Substring fallback pass

| Field | Value |
|---|---|
| Epic | EPIC-05 Search |
| Status | Not started |
| Depends on | T-036, T-037 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

Token matching assumes the user types whole words. Often they do not — they type
the first few letters, or a fragment they half-remember. For Tamil this is not an
edge case: agglutinative morphology means the form in the text frequently differs
from the form the user would type, and without stemming (correctly ruled out)
token matching alone will miss it.

A substring pass is cheap at this data size and turns "search found nothing" into
"search found it".

## Scope

**In:** the fallback pass, when it runs, and how its results rank.

**Out:** the token index (T-036), normalization (T-037).

## Requirements

**R1.** Run the substring pass when **either**:

- the query is shorter than 3 characters, or
- the token pass returned fewer than N results (suggest N = 5)

Not on every query — the token index is faster and more precise when it works.

**R2.** The pass scans normalized field text with `includes()`, over the same
fields and weights as the token index. Both sides go through `normalize.js`, as
in T-036's R8.

**R3. Substring hits rank below token hits.** A note where the query is a whole
word is a better match than one where it is a fragment. Merge the two result sets
with token matches first, de-duplicated by id.

**R4.** Mark results so the UI can distinguish them — T-040 may want to show
"partial matches" as a separate group.

**R5.** Also match a **prefix of a token** specifically, and rank those above
mid-word substring hits. Typing the start of a word is a stronger signal than
matching its middle.

**R6.** Cap the work: stop after scanning a bounded number of notes and say so in
the result, rather than scanning the whole collection for a one-character query.

**R7.** The fallback must work identically in Tamil and English. Test the Tamil
case explicitly — that is the case it exists for.

**R8.** Keep it in `search.js` as a separate function, testable on plain objects
under `node --test`.

## Files

- `src/background/search.js`
- `test/search.test.js`

## Reference

- `work/understandings/bible-com/07-i18n-and-scripts.md` — why substring matching
  is required for non-Latin scripts, not optional
- `work/requirements/EPIC-05-search/EPIC.md` — the non-negotiable rules

## Acceptance

- [ ] A two-character query returns sensible results instead of nothing
- [ ] A Tamil fragment that is not a whole token finds the note containing it
- [ ] A token match for the same query ranks above a substring match
- [ ] A prefix match ranks above a mid-word match
- [ ] Results are de-duplicated across the two passes
- [ ] Partial matches are distinguishable in the result metadata
- [ ] A one-character query completes quickly and reports that it was capped
- [ ] `node --test test/search.test.js` covers the Tamil fragment case

## Notes

This is the task that makes search usable for the primary user. Test it with
real Tamil text from a saved note, typing a fragment the way a person actually
would.
