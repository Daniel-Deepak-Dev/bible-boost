# EPIC-09 — Swap sides

**Goal:** one click on the dock turns `TAOVBSI | NKJV` into `NKJV | TAOVBSI`, the
new order is remembered, and the reader stays at the verse they were reading.

## Tasks

| Id | Title | Depends on |
|---|---|---|
| [T-056](T-056-swapped-url.md) | Build the swapped URL | T-001 |
| [T-057](T-057-dock-swap-button.md) | The ⇄ button on the dock | T-004, T-056 |
| [T-058](T-058-keep-reading-position.md) | Stay at the same verse after a swap | T-057 |

T-056 and T-057 are the feature. T-058 is what makes it pleasant to use, and T-057
ships without it: the swap works, and the reader lands at the top of the chapter.

## How a swap works

bible.com has no left-or-right setting. **The version in the URL's path goes on the
left**, and the one in `?parallel=` goes on the right. This was measured on swapped
URLs on 2026-11-10 (`03-columns-and-versions.md`, Column order). So a swap is two ids
trading places in the URL:

```
/bible/339/EXO.13.TAOVBSI?parallel=114   ->   /bible/114/EXO.13.NKJV?parallel=339
```

Three things follow from that, and each task depends on them:

- **Memory needs no new storage.** `remember()` in `content.js` already stores
  `primaryId` and `parallelId` from the URL whenever two versions are on screen.
  bible.com's own Next and Previous links carry both ids, `parallelIdFor()` reads the
  stored pair when Parallel is turned back on, and the popup's Open button builds
  from it. A second copy of this fact in storage could only disagree with the URL.
- **The URL wins.** A bookmark or a shared link naming the other order opens as
  written, and that order then becomes the remembered one. Nothing redirects on
  arrival. This was the user's choice on 2026-11-10.
- **A swap is a full page load**, through `location.assign`, as `setParallel(true)`
  already is. `window.next.router` exists only in the page's main world and content
  scripts run in the isolated world. T-058 exists because of this.

## A consequence worth knowing

Only the primary column responds to a tap (`03-columns-and-versions.md`). So after a
swap, Highlight, Copy and Save to BibleBoost act on the version now on the left, and
a note saved there records that version as `primary`. This is correct, because
`primary` means "the version in the URL's path", and it is not something to work
around. Notes already saved are not touched.

## Definition of done

- [ ] On a parallel chapter, the dock shows a ⇄ button after the A switch
- [ ] One click puts each version on the other side
- [ ] The swapped order survives chapter navigation, Parallel off and on, the popup's
      Open button and a browser restart
- [ ] A link naming the other order opens as written
- [ ] After a swap the reader is at the same verse, not the top of the chapter
- [ ] Alignment, separators and `Alt+P/A/S` are unaffected on the swapped page
- [ ] With `DEBUG_SCHEDULE = true`, using the button does not spam `align()`
