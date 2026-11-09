# T-011 — Version abbreviation and language resolution

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Done |
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

**R1.** Move the `VERSIONS` array from `popup.js` to shared code as a map of
`id -> { abbr, name }`, and have `popup.js` consume it. This removes a copy-paste
risk before it becomes one, in the same spirit as the T-001 move.

Note `popup.js` is a classic script and `refs.js` is an ES module, so the popup
becomes `<script type="module">`. It is an extension page, so this is free.

*Corrected during the work.* This requirement first put the table in `refs.js`
alone, but R2 step 3 needs it in `capture.js`, a classic script that cannot import
`refs.js`. The one definition is in `src/shared/versions.js`, which loads both
ways: the manifest lists it for the content scripts as `BB.VERSIONS`, and `refs.js`
imports it and re-exports `VERSIONS` for the popup. It is a JavaScript `Map`,
because an object keyed by these ids would change the popup's order.

**R2.** `resolveVersion(col) -> { versionId, abbr, lang, source }` with this chain:

1. The abbreviation in the URL, `BB.dom.parseUrl().abbr`: whatever follows
   `BOOK.CHAPTER` and any verses, so `EXO.13.TAOVBSI` gives `TAOVBSI`.
   **Primary column only**, and absent from the URLs the popup builds.
2. A link inside `main` that names the column's numeric id.
3. The `VERSIONS` table.
4. The raw numeric id as a string.

*Corrected during the work.* Step 1 said "third segment", but a verse URL puts it
fourth. Step 2 said the version chip's text, but nothing ties a chip to its column
except screen position, and a single-version page has no visible chip.
`03-columns-and-versions.md` records the chip's selector and the evidence.

**R3.** `lang` comes from `BB.dom.langOf(col)` (added in T-001), reading the
`iso6393xxx` class token. Return `null` when absent; do not guess from the text.

**R4.** **Never throw and never block a save.** An unknown version is normal —
the `VERSIONS` table covers only what the popup offers, and a user can read any
version id on bible.com.

**R5.** Record which step answered, for debugging, the same way T-008 reports its
`source`: `url`, `link`, `table` or `id`.

**R6.** When step 2 succeeds for an id missing from `VERSIONS`, **do not** write
it back into the table. Learned values belong in the note record, not in a shared
constant that other code would then trust.

## Files

- `src/shared/versions.js` — new, the table's one definition
- `src/shared/refs.js` — re-exports `VERSIONS` (the file exists since T-007)
- `src/content/bible-dom.js` — `parseUrl` gains `abbr`
- `src/content/capture.js` — `resolveVersion`
- `manifest.json` — lists `versions.js` for the content scripts
- `popup.js`, `popup.html` — consume the shared table
- `test/refs.test.js`, `test/bible-dom.test.js`

## Reference

- `work/understandings/bible-com/03-columns-and-versions.md` — the resolution
  order, the known-id table, and the warning that it is not exhaustive
- `work/understandings/bible-com/01-urls-and-routing.md` — why the parallel
  abbreviation is not in the URL
- `work/understandings/extension/05-mv3-constraints.md` — extension pages may be
  modules

## Acceptance

- [x] In a TAOVBSI + NKJV parallel view, both columns resolve to their correct
      abbreviations
- [x] Both columns resolve their ISO 639-3 language codes (`tam`, `eng`)
- [x] A version not in `VERSIONS` resolves via a page link (`source: 'link'`)
- [x] A version resolvable by nothing returns its numeric id as `abbr`, and
      `cleanNoteDraft` accepts it (there is no save path to run until T-014)
- [x] The popup's version pickers still work, with no duplicated table left in
      `popup.js`
- [x] The header-chip selector has been recorded in
      `work/understandings/bible-com/03-columns-and-versions.md`
- [x] Loaded unpacked in Chrome, `BB.dom.columns().map((c) =>
      BB.capture.resolveVersion(c))` from the BibleBoost console context gives the
      two expected results, and the standing regression check in CLAUDE.md passes

## Notes

The inspection for step 2 changed the step, and it also settled an old question in
`03-columns-and-versions.md`: the hashed `cat7xG_vid111` class follows the version
(NIV), not the column position. NIV therefore saves with `lang: null`, as R3
requires. The page does state NIV's language in a two-letter `lang` attribute, and
[B-010](../EPIC-08-maintenance/B-010-language-without-iso-token.md) tracks whether
to use it.

### How the ticked items were verified

On live bible.com on 2026-11-09, logged out, at a 1600px viewport. The browser used
cannot load an unpacked extension, so the version code from `bible-dom.js`,
`versions.js` and `capture.js` was pasted into the page with comments and unrelated
functions removed. Pages were reached through bible.com's own client-side router, so
the same injected code answered on every page.

| Page | Left column | Right column |
|---|---|---|
| `/bible/339/EXO.13.TAOVBSI?parallel=114` | TAOVBSI, tam, `url` | NKJV, eng, `link` |
| `/bible/114/EXO.13.NKJV?parallel=339` | NKJV, eng, `url` | TAOVBSI, tam, `link` |
| `/bible/339/EXO.13.TAOVBSI?parallel=1588` | TAOVBSI, tam, `url` | AMP, eng, `link` |
| `/bible/111/JHN.1?parallel=114` | NIV, null, `link` | NKJV, eng, `link` |
| `/bible/339/EXO.13.TAOVBSI` | TAOVBSI, tam, `url` | |
| `/bible/111/JHN.1` | NIV, null, `link` | |

After the AMP page the table still held 7 entries and had no 1588 (R6).

Detached elements covered what no live page produces. On `/bible/111/JHN.1`, where
no link names 59, `vid59` gave ESV from `table`. `vid999999` gave `999999` from `id`.
`vid59` with `BB.VERSIONS` deleted gave `59` from `id`. `null`, `{}` and an element
with no vid token each returned an empty result without throwing (R4).

Nothing saves a note until T-014, so the "still saves" half is a test in
`test/schema.test.js`, which runs a resolved-by-nothing side through `cleanNoteDraft`.

### The two boxes checked by hand

These needed the extension loaded, because they cover what injection cannot: the
manifest's load order, `BB.VERSIONS` in the isolated world, the popup running as a
module, and alignment still working. Done by hand with the unpacked extension in
Chrome on 2026-11-09, on `/bible/339/EXO.13.TAOVBSI?parallel=114`: the popup's
pickers, the console call in the last acceptance item, and the standing regression
check, including `Alt+P/A/S`. That run was on T-011 alone. The console call was then
repeated from the `main` checkout once T-011 had been merged with T-009's
`capture.js`, and gave the expected results.

Not checked: a signed-in session, a non-English interface language, and a viewport
narrow enough to hide the docked chip row. That last one should fall through to the
chapter arrows, or to the table.
