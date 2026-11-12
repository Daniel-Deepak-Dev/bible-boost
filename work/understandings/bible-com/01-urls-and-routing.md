# bible.com — URLs and routing

Confidence: **verified** against live pages and `src/content/bible-dom.js`.

## Reader URL shape

```
https://www.bible.com/bible/<versionId>/<BOOK>.<chapter>.<ABBR>?parallel=<versionId>
                            339          EXO  . 13     . TAOVBSI        114
```

| Part | Meaning | Notes |
|---|---|---|
| `versionId` | numeric id of the **primary** version | 339 = TAOVBSI, 114 = NKJV, 111 = NIV |
| `BOOK` | USFM book code | Always 3 characters: JHN, 1CO, 3JN, EXO |
| `chapter` | digits | |
| `ABBR` | abbreviation of the **primary** version only | **Not present for the parallel column**, and optional even for the primary (trap 4) |
| `parallel` query param | numeric id of the second version | Absent when reading a single version |

`BB.dom.parseUrl()` in `src/content/bible-dom.js` is the canonical parser (moved
out of `content.js` in T-001). It returns
`{ id, ref: 'EXO.13' or null, parallel: '114' or null, abbr: 'TAOVBSI' or null }`.
`abbr` belongs to the version at `id`, and is decoded.

## Traps

1. **A book-intro URL has no chapter.** `JHN.INTRO1` fails `REF_RE`
   (`/^([A-Z0-9]{3})\.(\d+)/`) and yields a null ref. Those pages render **no
   parallel column at all**. Any feature that assumes a chapter must handle null.
   `remember()` still stores the pair from such a URL when it has `?parallel=`,
   because it compares only the ids (seen 2026-11-10, running the real `content.js`
   on T-057's local test page).

2. **A parallel id repeating the primary id renders ONE column.** bible.com
   collapses the view. `parallelIdFor()` exists purely to never hand it the id it
   is already showing. Storing a pair where both sides are equal silently breaks
   the popup's Open button.

3. **The parallel version's abbreviation is NOT in the URL.** Only its numeric
   id. To get NKJV, read a link in the page that names that id, or map the id
   through the VERSIONS table. See `03-columns-and-versions.md`.

4. **The abbreviation is not always there, or always third.** `/bible/111/JHN.1`
   is served as it is, with no redirect, and it is the URL the popup's Open button
   builds. On a verse URL, `JHN.3.16.NIV`, it is the fourth dot-part, and a menu
   link can read `EXO.13.1-2,4.TAOVBSI`. `parseUrl` handles all of these.

## Swapping the two versions

bible.com has no left-or-right setting: the path's version goes on the left, so a swap
is the two ids trading places. `BB.dom.swappedUrl(href, newPrimaryAbbr)` in
`src/content/bible-dom.js` is the canonical rewrite (T-056), and it returns `null`
when there is nothing to swap. Any other code that needs that answer should call it.

- **The abbreviation has to change with the id.** It names the path's version, so
  leaving it would call NKJV's page TAOVBSI. What bible.com does with such a mismatch
  has not been tested.
- **Strip it with `ABBR_RE`'s raw capture, not `parseUrl().abbr`.** That value is
  decoded, and it is `null` when decoding fails, as on `EXO.13.BAD%E7`.
- **Never write a bare number as the abbreviation.** `resolveVersion` answers with
  the numeric id when it knows nothing better, and `EXO.13.114` reads as a verse.
- **`URL.pathname` leaves existing percent-escapes alone when set**, so an
  `encodeURIComponent` result is not encoded twice, and a stray `%` stays literal
  instead of throwing. Confirmed by the tests on Node 26.13.0. Chrome follows the same
  URL standard but was not run.

## SPA navigation

bible.com is client-side routed. Changing chapter or version does **not** reload
the page, and the content script is injected once at `document_idle`.

There is **no pushState hook** in the codebase. Navigation is detected by four
independent mechanisms, all feeding one throttled `schedule()` (80 ms + rAF):

| Mechanism | Catches |
|---|---|
| MutationObserver on `document.body`, childList + subtree | chapter nav, version change, re-renders |
| `popstate` listener | back / forward |
| `setInterval(..., 400)` comparing `location.href` | a pushState the observer missed |
| `document.fonts` `loadingdone` | late font swap changing metrics |

Plus a ResizeObserver on the column elements (re-bound by a 1 s interval when the
column set changes) for the reader's own "Aa" font-size control, which changes
height without any DOM change. The same observer is what re-aligns after T-018's
pinned squeeze: `padding-right` on `body` narrows the columns, they re-wrap and grow
taller, and it fires. Nothing else calls `schedule()` for a pin. Seen working in a
real Chrome on 2026-11-11, after both pin and unpin.

**If you add a feature that must survive navigation, hook `schedule()` — do not
add a fifth polling loop.** The side panel's chapter relay (T-023) does: it runs
from `panel-host.js`'s `render()`, which `refresh()` calls on every pass.

**The address and the chapter heading change together.** The reader's chapter
arrows are links labelled **Previous Chapter** and **Next Chapter**, round
**‹** and **›** buttons at the lower left and right of the reader. On Exodus 13,
clicking **Next Chapter** changed the path to `EXO.14` and the primary `<h1>` to
"யாத்திராகமம் 14" within one 10 ms sample, 95 ms after the click (measured
2026-11-12, on the live page, with no extension). One navigation, so code that
reads both should still tolerate them disagreeing for a pass.

`/bible/111/JHN.INTRO1.NIV` is a real book intro to test against: its `<h1>` is
"John Intro", and its **Next Chapter** goes to `JHN.1.NIV`.

A full load is different: both columns are in the server's HTML, verse 140 of Psalm
119 included (measured 2026-11-10), so they exist when a content script runs at
`document_idle`.

To drive the same client-side navigation by hand, from the page's own console
context, use `window.next.router.push('/bible/339/EXO.13.TAOVBSI?parallel=1588')`.
Code injected for a test survives it, where `location.href =` would wipe it. Seen
working 2026-11-09.

## Content-script match pattern

`https://www.bible.com/*` only. A bare `bible.com` without `www` is **not**
matched, and neither is any other host. If the extension appears dead, check the
hostname first.
