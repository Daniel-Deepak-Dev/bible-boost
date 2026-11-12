# T-023 — Default to the chapter on screen

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Not started |
| Depends on | T-021 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

The panel is open **while reading a specific chapter**. Showing all notes ever
written, ordered by date, makes the user hunt for the three that matter right
now. Defaulting to the chapter on screen turns the panel from an archive into
part of the reading experience.

This is the main thing that distinguishes an on-page panel from the full-page
app, which should default to everything.

## Scope

**In:** the contextual default, the scope control, and keeping it current across
SPA navigation.

**Out:** search and filter UI (EPIC-05).

## Requirements

**R1.** On open, default the list to notes whose `verseKeys` fall in the chapter
currently on screen, from `BB.dom.parseUrl().ref` (e.g. `EXO.13`).

**R2.** A compact scope control in the header, offering **This chapter** /
**This book** / **All**. One control, not three filters.

**R3.** Show the count per scope so an empty chapter does not look like a bug —
"This chapter (0) · This book (12)". Seeing that notes exist elsewhere is the
difference between "nothing here" and "something is broken".

**R4. The host relays the chapter, the panel does not read the URL.** The iframe
cannot see the page. `panel-host.js` posts
`{ bb: 'context', ref: 'EXO.13', versions: [...] }` on open and on every
navigation.

**R5.** On client-side chapter navigation, update automatically **if** the scope
is This chapter or This book. If the user has switched to All, leave it alone —
they made an explicit choice.

**R6.** If the user has an unsaved edit open, do **not** switch the list out from
under them. Show an unobtrusive "now reading Exodus 14" affordance and switch
when they finish.

**R7.** Remember the last scope in `chrome.storage.local`.

**R8.** Book scope matches on the book part of `verseKeys`, so a note saved on
`EXO.13.2` appears under book scope for any Exodus chapter. Use the `byVerse`
index with a prefix range; do not load everything and filter.

**R9.** On a page where `parseUrl()` returns null — a book intro, for instance —
fall back to All scope rather than showing an empty list.

## Files

- `src/ui/app/list.js`, `src/ui/panel.js`
- `src/content/panel-host.js` — the context relay
- `src/background/repo.js` — chapter and book prefix filters, if T-005 left them
  out

## Reference

- `work/understandings/bible-com/01-urls-and-routing.md` — `parseUrl` returns
  chapter-level refs, and is null on book intros
- `work/understandings/extension/03-messaging.md` — the `bb:context` message
- `work/understandings/extension/02-storage-model.md` — the `byVerse` multiEntry
  index

## Acceptance

- [ ] Opening the panel on Exodus 13 shows only notes on that chapter
- [ ] The scope control shows non-zero counts for book and all
- [ ] Navigating to Exodus 14 client-side updates the list automatically
- [ ] With scope set to All, navigating does **not** change the list
- [ ] With an unsaved edit open, navigating does not swap the list out
- [ ] Book scope shows notes from every chapter of that book
- [ ] A chapter with no notes shows a clear empty state plus the other counts
- [ ] On a book-intro page the panel falls back to All
- [ ] The scope choice survives a reload

## Notes

R3 is small and prevents the most likely support question. R6 prevents the most
likely data-loss complaint.

**From T-022 (2026-11-12).** Close the open editor before calling
`list.setFilter` (`closeEditor()` in `panel.js` saves first). The list keeps an open
row through a filter change, at the top, because it holds what is being typed, but
a note from another chapter left open over a new chapter's list would confuse.
