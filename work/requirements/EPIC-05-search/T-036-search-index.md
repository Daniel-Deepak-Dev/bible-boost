# T-036 — In-memory search index in the worker

| Field | Value |
|---|---|
| Epic | EPIC-05 Search |
| Status | Not started |
| Depends on | T-005 |
| Blocks | T-038, T-039, T-040, T-041 |
| Size | M |
| Risk | Medium |

## Why

Search belongs in the worker because the worker owns the data — the index can be
built straight from a cursor over the `notes` store, and every surface gets the
same results from one implementation.

An in-memory inverted index is the right size of solution here. A personal notes
collection is thousands of records, not millions, and the alternative — a
dependency — brings an English-centric tokenizer that is wrong for this content.

## Scope

**In:** building the index, the query path, and ranking.

**Out:** normalization internals (T-037), the fallback pass (T-038), filters
(T-039), the UI (T-040), invalidation (T-041).

## Requirements

**R1.** `src/background/search.js` builds a token → note-id inverted index by
cursoring the `notes` store once. Keep per-token field information so ranking can
weight fields.

**R2.** Indexed fields, with weights:

| Field | Weight |
|---|---|
| title | highest |
| tags | high |
| topic name | high |
| `displayRef` and `usfm` | high |
| body | medium |
| `primary.text` | medium |
| `parallel.text` | medium |

**Both** verse texts are indexed. That is the point of capturing them.

**R3.** Ranking: sum of weighted field hits, boosted by how many distinct query
terms matched, with recency as a tiebreak. Do not over-engineer — a simple,
explainable score beats an opaque one that cannot be debugged.

**R4.** Multi-term queries are **AND by default** — every term must appear
somewhere in the note, not necessarily in the same field.

**R5.** Return note ids plus match metadata (which fields matched, where), so
T-040 can highlight without re-searching.

**R6.** **The worker is not persistent.** Treat the index as a cache that may be
absent: rebuild lazily on first query after a cold start, and keep the rebuild
fast enough that the user does not notice (target well under 200ms for ~2000
notes).

**R7.** Exclude notes with `deletedAt != null` unless the query is scoped to
Trash.

**R8.** All text goes through `src/shared/normalize.js` (T-037) on both index and
query sides. Indexing and querying **must** use the same function — a mismatch is
the classic cause of "it is definitely in there but search cannot find it".

**R9.** Cap memory: if the collection grows past a threshold, index the verse
texts' first N characters rather than all of them, and say so in a comment.

**R10.** `test/search.test.js` runs against plain objects with no IndexedDB, so
the ranking logic is testable under `node --test`. That means the scoring
function takes records, not a database handle.

## Files

- `src/background/search.js` — new
- `src/shared/normalize.js` — shared with T-037
- `background.js` — the `search/query` handler
- `test/search.test.js` — new

## Reference

- `work/understandings/bible-com/07-i18n-and-scripts.md` — **the normalization
  rules; read before writing a tokenizer**
- `work/understandings/extension/02-storage-model.md` — note and `VerseRef`
  shapes
- `work/understandings/extension/05-mv3-constraints.md` — worker lifetime
- `work/understandings/extension/03-messaging.md` — `search/query`

## Acceptance

- [ ] A word present only in the Tamil verse text finds the note
- [ ] A word present only in the NKJV verse text finds the same note
- [ ] A word in the body, a tag, a topic name and a reference each find their
      notes
- [ ] A title match ranks above a body match for the same term
- [ ] Two terms AND correctly — a note with only one does not match
- [ ] Results include which fields matched
- [ ] Trashed notes do not appear
- [ ] After a worker restart, the first query rebuilds and returns correct
      results
- [ ] 2000 notes index in well under 200ms
- [ ] `node --test test/search.test.js` passes with no IndexedDB

## Notes

R8 is the single most common search bug. Write one `normalizeForIndex()` and call
it from both sides; never inline a `.toLowerCase()` anywhere in this file.
