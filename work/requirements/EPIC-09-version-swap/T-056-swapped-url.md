# T-056 — Build the swapped URL

| Field | Value |
|---|---|
| Epic | EPIC-09 Swap sides |
| Status | Done |
| Depends on | T-001 |
| Blocks | T-057 |
| Size | S |
| Risk | Low — pure function, fully covered by Node tests |

## Why

Swapping sides means rewriting the reader URL, and that URL has more shapes than it
first appears to: the abbreviation can be missing, it can sit fourth rather than
third, and it can be percent-encoded. Keeping the rewrite pure puts every one of
those shapes under `node --test` instead of leaving them to a manual check.

## Scope

**In:** one pure function and its tests.

**Out:** the button and where the abbreviation comes from (T-057), and the reading
position (T-058).

## Requirements

**R1.** Add `swappedUrl(href = location.href, newPrimaryAbbr = null)` to
`src/content/bible-dom.js`, beside `parseUrl`, and export it on `BB.dom`. It uses
nothing but `URL`, so it runs under the existing `node:vm` harness in
`test/bible-dom.test.js`.

**R2.** It returns the swapped URL as an absolute string, or `null` when there is
nothing to swap:

| Input | Why it is `null` |
|---|---|
| Not a reader URL | `parseUrl` returns `null` |
| No `?parallel=` | One version, nothing to trade |
| `parallel` equals `id` | bible.com renders one column (`01-urls-and-routing.md`, trap 2) |
| `ref` is `null`, as on `JHN.INTRO1` | Book intros have no parallel column (trap 1) |

T-057 uses that `null` to decide whether the button exists, so these conditions live
in this one function.

**R3.** The path's id becomes the old `parallel`, and `?parallel=` becomes the old
id.

**R4.** The old abbreviation names the old primary, so it is **never left on the new
path**. It is replaced by `newPrimaryAbbr`, or dropped when there is none. A path
with no abbreviation is served as it is, without a redirect (trap 4).

**R5.** Strip the old abbreviation using `ABBR_RE`'s raw capture on the path's slug.
Do not use `parseUrl().abbr`: that value is decoded, and it is `null` on a slug with
a stray `%`, in which case the old abbreviation would be left in place.

**R6.** `newPrimaryAbbr` is written with `encodeURIComponent`, because bible.com's
own links percent-encode it: version 48's is `CUNPSS-%E7%A5%9E`.

**R7.** An empty `newPrimaryAbbr`, or one matching `/^[\d,-]+$/`, is treated as
absent. `resolveVersion` returns the numeric id as `abbr` when it finds nothing
better, and `ABBR_RE`'s lookahead would read a trailing number as verses, so
`EXO.13.114` would not mean what it says.

**R8.** Everything else survives: a verse part of the slug (`JHN.3.16`,
`EXO.13.1-2,4`), anything before `/bible/` (`parseUrl`'s regex is not anchored, so
it accepts a prefix), other query parameters and the hash.

## Files

- `src/content/bible-dom.js` — `swappedUrl`, and the `BB.dom` export
- `test/bible-dom.test.js` — the cases below

## Reference

- `work/understandings/bible-com/01-urls-and-routing.md` — URL shape and traps 1, 2, 4
- `work/understandings/bible-com/03-columns-and-versions.md` — Column order, percent-encoding
- `work/understandings/conventions/01-code-style.md`

## Acceptance

`node --test` passes, from the repository root with no path, with a test for each:

- [x] `/bible/339/EXO.13.TAOVBSI?parallel=114` with `'NKJV'` gives
      `/bible/114/EXO.13.NKJV?parallel=339`
- [x] The same URL with no abbreviation gives `/bible/114/EXO.13?parallel=339`
- [x] `/bible/111/JHN.1?parallel=114`, which has no abbreviation to begin with, swaps
- [x] `/bible/339/JHN.3.16.TAOVBSI?parallel=114` keeps `JHN.3.16`
- [x] `/bible/339/EXO.13.1-2,4.TAOVBSI?parallel=114` keeps `EXO.13.1-2,4`
- [x] `'CUNPSS-神'` is written as `CUNPSS-%E7%A5%9E`
- [x] A slug with a stray `%` in its abbreviation still loses that abbreviation
- [x] `'114'` and `''` as the abbreviation give the same result as none
- [x] Another query parameter, a hash and a path prefix are all kept
- [x] Swapping twice, with each side's abbreviation, returns the original URL
- [x] `null` for each row of the R2 table

## Notes

Whether bible.com really serves a locale prefix before `/bible/` is not recorded in
`01-urls-and-routing.md`. R8 keeps one only because `parseUrl` already accepts it.
This task did not establish the answer either.

**Not run: the standing regression check on a live parallel chapter.** `bible-dom.js`
is page-side code, and the session that did this could not load the unpacked
extension. The only change to code already running on the page is `parseUrl`'s path
pattern moving into `PATH_RE`, which the existing `parseUrl` tests cover. `swappedUrl`
has no caller until T-057, whose acceptance list includes that check.
