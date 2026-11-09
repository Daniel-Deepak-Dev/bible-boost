# B-010 — A version with no `iso6393` token saves with no language

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Found by T-011 |
| Blocks release | No |
| Depends on | T-011 |
| Size | S |
| Risk | Low |

## The problem

`BB.dom.langOf(col)` reads the `iso6393xxx` class token. NIV's column is
`cat7xG_vid111`, with no such token in either column position, so a verse saved
from NIV stores no language. NIV is the popup's default primary version.

T-011 R3 requires exactly this: read the token, and return `null` when it is
absent. So this is not a defect in T-011. It is a limit of the one source it uses.

## What the page offers instead

Each column sits four levels inside a `div` with a `lang` attribute, reached by
`col.closest('[lang]')`. Measured 2026-11-09 with `<html lang="en">`:

| Column | `iso6393` token | wrapper `lang` |
|---|---|---|
| TAOVBSI | `tam` | `ta` |
| NKJV | `eng` | `en` |
| NIV | none | `en` |

## Scope

**In:** deciding whether a version with no token may take its language from the
wrapper, and doing it if so.

**Out:** changing the code stored for versions that already have a token, or
guessing a language from the verse text.

## Requirements

**R1.** Decide how the two code systems meet. Stored values are ISO 639-3 today
(`tam`, `eng`), and the wrapper gives ISO 639-1 (`ta`, `en`). Storing `en` beside
`eng` splits one language in two for anything that filters on it. A conversion
needs a table, which raises the same "not exhaustive" problem `VERSIONS` has.

**R2.** Never read `<html lang>`, which is the interface language. `closest` can
reach it when no wrapper exists, so the match must rule it out.

**R3.** The token stays first, and an absent language still comes back as `null`.

**R4.** Update T-011's R3 and `03-columns-and-versions.md` to match the decision.

## Files

- `src/content/bible-dom.js` — `langOf`

## Reference

- `work/understandings/bible-com/03-columns-and-versions.md` — "Language code, free"
- `work/understandings/extension/02-storage-model.md` — the `VerseRef` shape

## Acceptance

- [ ] A verse from an NIV column stores a language, in the code R1 settles on
- [ ] TAOVBSI and NKJV still store `tam` and `eng`
- [ ] A column with neither the token nor a wrapper still gives `null`
- [ ] No value ever comes from `<html lang>`
