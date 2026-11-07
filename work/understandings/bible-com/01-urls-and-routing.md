# bible.com — URLs and routing

Confidence: **verified** against live pages and `content.js`.

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
| `ABBR` | abbreviation of the **primary** version only | **Not present for the parallel column** |
| `parallel` query param | numeric id of the second version | Absent when reading a single version |

`parseUrl()` in `content.js` is the canonical parser. It returns
`{ id, ref: 'EXO.13' or null, parallel: '114' or null }`.

## Traps

1. **A book-intro URL has no chapter.** `JHN.INTRO1` fails `REF_RE`
   (`/^([A-Z0-9]{3})\.(\d+)/`) and yields a null ref. Those pages render **no
   parallel column at all**. Any feature that assumes a chapter must handle null.

2. **A parallel id repeating the primary id renders ONE column.** bible.com
   collapses the view. `parallelIdFor()` exists purely to never hand it the id it
   is already showing. Storing a pair where both sides are equal silently breaks
   the popup's Open button.

3. **The parallel version's abbreviation is NOT in the URL.** Only its numeric
   id. To get NKJV you must read it from the column header chip in the DOM, or
   map the id through the VERSIONS table. See `03-columns-and-versions.md`.

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
height without any DOM change.

**If you add a feature that must survive navigation, hook `schedule()` — do not
add a fifth polling loop.**

## Content-script match pattern

`https://www.bible.com/*` only. A bare `bible.com` without `www` is **not**
matched, and neither is any other host. If the extension appears dead, check the
hostname first.
