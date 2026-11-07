# T-028 — Sort and filter

| Field | Value |
|---|---|
| Epic | EPIC-03 Full-page app |
| Status | Not started |
| Depends on | T-025 |
| Blocks | — |
| Size | M |
| Risk | Low |

## Why

Date order is right for "what was I just doing" and wrong for everything else.
A user studying Exodus wants their notes in **verse order**, which is the one
sort a generic notes app never has and a Bible notes app must.

## Scope

**In:** sort orders, filters, and the canonical verse ordering they need.

**Out:** text search (EPIC-05) — this is structured filtering; search is
different and composes with it.

## Requirements

**R1.** Sort orders: **Updated** (default), **Created**, **Verse order**,
**Title**, **Topic**. Ascending and descending.

**R2. Verse order means canonical order** — book index, then chapter, then verse.
Never alphabetical by book code: `1CO` before `ACT` is wrong, and
`EXO.13.10` before `EXO.13.2` is wrong.

`src/shared/refs.js` owns the 66-book canonical index. A note with several verses
sorts by its **first** verse. A note with none sorts last.

**R3.** Title sort uses `Intl.Collator`, not `<`. A plain comparison puts every
Tamil title in a block away from the English ones, ordered by code point.

```js
new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
```

**R4.** Filters, combinable: topic (including Uncategorized), tag (several, AND
or OR), book or chapter, version, date range, has-verse / standalone, pinned.

**R5.** Show active filters as removable chips with a "clear all". A filter the
user has forgotten about is indistinguishable from missing data, and generates
the "my notes disappeared" report.

**R6.** Filters and sort are reflected in the URL hash so a view can be
bookmarked and the back button works.

**R7. Use the indexes.** Filtering by topic uses `byTopic`, by tag uses `byTag`,
by verse uses `byVerse` with a prefix range. Loading every note and filtering in
memory defeats the entire reason for choosing IndexedDB.

**R8.** When filters combine, pick the **most selective** index first and filter
the rest in memory — do not intersect several full index scans.

**R9.** Show the result count against the total: "24 of 310 notes".

**R10.** Persist the last sort in `storage.local`. Do **not** persist filters —
a filter silently restored from a previous session is the same "missing data"
problem as R5, with no visible chip to explain it. Deliberate decision; comment
it.

## Files

- `src/ui/app/filters.js` — new
- `src/ui/app/list.js` — sort and filter state
- `src/shared/refs.js` — canonical book index, comparator
- `src/background/repo.js` — index-backed queries
- `test/refs.test.js` — canonical ordering cases

## Reference

- `work/understandings/extension/02-storage-model.md` — the indexes
- `work/understandings/bible-com/07-i18n-and-scripts.md` — `Intl.Collator`,
  canonical ordering
- `work/understandings/extension/03-messaging.md` — `notes/list` filter payload

## Acceptance

- [ ] Verse order puts Genesis before Exodus, and `EXO.13.2` before `EXO.13.10`
- [ ] `1CO` sorts after `ACT`, per canonical order
- [ ] Title sort interleaves Tamil and English sensibly
- [ ] Topic + tag + book filters combine correctly
- [ ] Active filters show as chips and can be cleared individually
- [ ] The hash round-trips: copy the URL, reopen, same view
- [ ] With 2000 notes, filtering by topic is instant — verify the index is used,
      not a full scan
- [ ] The result count shows against the total
- [ ] Sort persists across reloads; filters deliberately do not
- [ ] `node --test test/refs.test.js` covers the ordering cases

## Notes

R2 is the task's real content. Seed a few notes across Genesis, Exodus, Acts and
1 Corinthians before testing — the bug is invisible with notes from one book.
