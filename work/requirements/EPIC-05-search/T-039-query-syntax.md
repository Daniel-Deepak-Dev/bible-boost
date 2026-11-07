# T-039 — Field filters in the query

| Field | Value |
|---|---|
| Epic | EPIC-05 Search |
| Status | Not started |
| Depends on | T-036 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

"Every note tagged `faith` in Exodus" is a question the user will actually have,
and expressing it by clicking through three filter menus is slower than typing
it. A small prefix syntax costs little and composes with the filter UI from
T-028 rather than competing with it.

## Scope

**In:** parsing field prefixes out of the query string and applying them.

**Out:** the filter chips UI (T-028), ranking (T-036).

## Requirements

**R1.** Support these prefixes, parsed out of the free-text query:

| Prefix | Matches |
|---|---|
| `topic:<name>` | topic name, or `topic:none` for Uncategorized |
| `tag:<name>` | a tag |
| `ref:<usfm>` | a verse, chapter or book prefix — `ref:EXO`, `ref:EXO.13`, `ref:EXO.13.2` |
| `version:<abbr>` | a note with a verse in that version, either side |
| `is:pinned`, `is:standalone`, `is:trashed` | flags |

**R2.** Anything not matching a prefix is free text and goes to T-036. A query
may mix both: `tag:faith covenant`.

**R3.** Filters AND together. Free-text terms AND as well, per T-036's R4.

**R4.** `ref:` matches on **prefix**, using the canonical `usfm` — so `ref:EXO`
matches every verse in Exodus. Use the `byVerse` index with a prefix range, not a
scan.

**R5. Match `topic:` and `tag:` on the normalized name**, through
`normalize.js`. `topic:Faith` and `topic:faith` are the same query, and a Tamil
topic name must match.

**R6.** A quoted value allows spaces: `topic:"Exodus study"`.

**R7.** `version:` checks **both** `primary.abbr` and `parallel.abbr`. A note
saved while reading TAOVBSI+NKJV should be found by either.

**R8. An unknown prefix is treated as free text**, not an error. `http://x` must
not be parsed as a `http:` filter. Only recognised prefixes are special.

**R9.** The parser is a pure function in `src/shared/` and is covered by
`node --test`.

**R10.** Show parsed filters as chips in the search bar (T-040), so the syntax is
discoverable rather than hidden — and so a user who typed a filter by accident
can see it.

## Files

- `src/shared/query.js` — new, the parser
- `src/background/search.js` — apply the filters
- `test/query.test.js` — new

## Reference

- `work/understandings/extension/02-storage-model.md` — the `byVerse` and
  `byTag` indexes
- `work/understandings/bible-com/07-i18n-and-scripts.md` — normalize before
  comparing names
- `work/understandings/extension/03-messaging.md` — the `search/query` payload

## Acceptance

- [ ] `tag:faith` returns only notes with that tag
- [ ] `topic:"Exodus study" covenant` applies both the filter and the free text
- [ ] `ref:EXO` returns notes on any Exodus verse
- [ ] `ref:EXO.13` narrows to that chapter
- [ ] `version:NKJV` finds notes where NKJV is the parallel side, not only the
      primary
- [ ] `topic:none` returns Uncategorized notes
- [ ] `is:pinned` works
- [ ] A Tamil topic name matches regardless of case or NFC form
- [ ] `http://example.com` in a query is treated as free text
- [ ] An unknown prefix such as `foo:bar` is treated as free text
- [ ] `node --test test/query.test.js` covers all of the above

## Notes

R8 is the one that bites. A naive `split(':')` turns every URL and every verse
reference typed with a colon into a broken filter.
