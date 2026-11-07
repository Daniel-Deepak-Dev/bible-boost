# T-011 — Version abbreviation and language resolution

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Not started |
| Depends on | T-001 |
| Blocks | T-010 |
| Size | S |
| Risk | Low |

## Why

A note that says "version 114" is useless to read later; it needs to say "NKJV".
But the URL carries the abbreviation for the **primary column only** — the
parallel column is identified by a bare numeric id.

There is also a small `VERSIONS` table already in `popup.js`, which is the right
thing to promote and reuse rather than duplicate.

## Scope

**In:** resolving a version id to an abbreviation and a language code, with a
fallback chain; promoting the existing table to shared code.

**Out:** fetching anything from the network, or shipping a complete list of
bible.com's versions.

## Requirements

**R1.** Move the `VERSIONS` array from `popup.js` into `src/shared/refs.js` as a
map of `id -> { abbr, name }`, and have `popup.js` consume it. This removes a
copy-paste risk before it becomes one, in the same spirit as the T-001 move.

Note `popup.js` is a classic script and `refs.js` is an ES module, so the popup
either becomes `<script type="module">` or gets a small classic mirror. **Prefer
making the popup a module** — it is an extension page, so this is free.

**R2.** `resolveVersion(col) -> { versionId, abbr, lang }` with this chain:

1. URL third segment via `BB.dom.parseUrl()` — `EXO.13.TAOVBSI` gives `TAOVBSI`.
   **Primary column only.**
2. The column header chip text — the version button above the column.
   **Selector unverified; inspect and record it.**
3. The `VERSIONS` table.
4. The raw numeric id as a string.

**R3.** `lang` comes from `BB.dom.langOf(col)` (added in T-001), reading the
`iso6393xxx` class token. Return `null` when absent; do not guess from the text.

**R4.** **Never throw and never block a save.** An unknown version is normal —
the `VERSIONS` table covers only what the popup offers, and a user can read any
version id on bible.com.

**R5.** Record which step answered, for debugging, the same way T-008 reports its
`source`.

**R6.** When step 2 succeeds for an id missing from `VERSIONS`, **do not** write
it back into the table. Learned values belong in the note record, not in a shared
constant that other code would then trust.

## Files

- `src/shared/refs.js` — new, holding `VERSIONS`
- `src/content/capture.js` — `resolveVersion`
- `popup.js`, `popup.html` — consume the shared table

## Reference

- `work/understandings/bible-com/03-columns-and-versions.md` — the resolution
  order, the known-id table, and the warning that it is not exhaustive
- `work/understandings/bible-com/01-urls-and-routing.md` — why the parallel
  abbreviation is not in the URL
- `work/understandings/extension/05-mv3-constraints.md` — extension pages may be
  modules

## Acceptance

- [ ] In a TAOVBSI + NKJV parallel view, both columns resolve to their correct
      abbreviations
- [ ] Both columns resolve their ISO 639-3 language codes (`tam`, `eng`)
- [ ] A version not in `VERSIONS` resolves via the header chip
- [ ] A version resolvable by nothing returns its numeric id as `abbr`, and the
      save still succeeds
- [ ] The popup's version pickers still work, with no duplicated table left in
      `popup.js`
- [ ] The header-chip selector has been recorded in
      `work/understandings/bible-com/03-columns-and-versions.md`

## Notes

Step 2's selector is the unverified part. Find it, use it, and write it down —
leaving it undocumented pushes the same investigation onto the next session.
