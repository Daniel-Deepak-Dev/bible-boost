# T-023 — Default to the chapter on screen

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | In progress |
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
*As built (decided with the user, 2026-11-12):* it takes the place of the
"BibleBoost" title, as `[Chap 3|Book 12|All 40]`, because the title and the
three segments do not fit side by side at 280px. The full names are the
accessible ones.

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
*As built:* any open editor holds the list, changed or not. Whether it has
changes alters with every key, and an open note from another chapter over a new
chapter's list would confuse either way (T-022's note below). The affordance
has a **Show** button that closes the editor, asking first if it has changes,
and switches at once.

**R7.** Remember the last scope in `chrome.storage.local`.

**R8.** Book scope matches on the book part of `verseKeys`, so a note saved on
`EXO.13.2` appears under book scope for any Exodus chapter. Use the `byVerse`
index with a prefix range; do not load everything and filter.

**R9.** On a page where `parseUrl()` returns null — a book intro, for instance —
fall back to All scope rather than showing an empty list.

## Files

- `src/ui/app/list.js`, `src/ui/panel.js`, `src/ui/panel.html`
- `src/ui/app/scope.js` (new) — the scope rules and the control; its rules are
  in `test/scope.test.js`
- `src/content/panel-host.js` — the context relay; `src/content/capture.js`
  shares `headingOf` with it for the chapter's name
- `src/background/repo.js`, `src/shared/schema.js` — the book filter. T-005 had
  the chapter one already

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

## Test it by hand

Written 2026-11-12. bible.com's names below were read off the live page that
day: the chapter arrows are labelled **Previous Chapter** and **Next Chapter**.

1. **Load the change.** `chrome://extensions` → BibleBoost → the reload arrow,
   then reload every bible.com tab that was open.
2. **Starting state.** A maximised window on
   `https://www.bible.com/bible/339/EXO.13.TAOVBSI?parallel=114`, either theme.
   You need notes on Exodus 13, on another chapter of Exodus (14 is used below)
   and in another book (Genesis 1, say). Save any that are missing: tap a verse →
   **Save to BibleBoost** → **Save**.
3. Back on Exodus 13, click the slim **B** tab on the right edge. The panel's
   header no longer says BibleBoost: it starts with three joined segments,
   **Chap**, **Book** and **All**, each followed by a number, with **Chap** lit.
   The list holds only Exodus 13's notes. **Book** and **All** show larger
   numbers than **Chap**. → Acceptance: Opening the panel on Exodus 13 shows only
   notes on that chapter; The scope control shows non-zero counts for book and all
4. Click the round **›** at the lower right of the reader (**Next Chapter**). The
   page goes to Exodus 14 without reloading, and within a moment the list shows
   only Exodus 14's notes and **Chap**'s number changes. → Acceptance: Navigating
   to Exodus 14 client-side updates the list automatically
5. Click **Book**. The list shows your notes from every chapter of Exodus,
   Exodus 13's and 14's included, and nothing from Genesis. → Acceptance: Book
   scope shows notes from every chapter of that book
6. Click **Chap**, then **‹** (**Previous Chapter**) until you reach a chapter of
   Exodus with no notes. The list says
   **No notes on யாத்திராகமம் N yet. யாத்திராகமம் has M notes.**, and the header
   shows **Chap 0** beside a non-zero **Book**. → Acceptance: A chapter with no
   notes shows a clear empty state plus the other counts
7. Click **All**. Every note shows. Click **›**: the list stays exactly as it was,
   and only **Chap**'s and **Book**'s numbers change. → Acceptance: With scope set
   to All, navigating does **not** change the list
8. Go back to Exodus 13 and click **Chap**. Click the text of a note to open it,
   and type a word at the end without saving. Click **›**. The list stays as it
   was, with the note still open, and a line appears under the header:
   **Now reading யாத்திராகமம் 14**, with **Show** at its right. Click **Save** in
   the note. It saves, the line goes, and the list switches to Exodus 14.
   → Acceptance: With an unsaved edit open, navigating does not swap the list out
9. Open `https://www.bible.com/bible/111/JHN.INTRO1.NIV` ("John Intro"), and open
   the panel if it is closed. **All** is lit and every note shows. **Chap** and
   **Book** are dimmed and do nothing when clicked. Click **›**: on John 1 the
   panel goes back to the chapter. → Acceptance: On a book-intro page the panel
   falls back to All
10. Click **Book**, then reload the page with **F5**. Open the panel if it is
    closed: **Book** is still lit. Set it back to **Chap** if you prefer.
    → Acceptance: The scope choice survives a reload
11. **Standing regression check**, because the host's page code changed. On
    `/bible/339/EXO.13.TAOVBSI?parallel=114`: the verses line up across the two
    columns, the separators draw, **Alt+P**, **Alt+A** and **Alt+S** work, and
    changing the reader's **Aa** size lines them up again.

**If a step fails**, send its number and what you saw instead. For steps 3 to 9,
the panel's own Console also says what it thinks: right-click inside the panel →
**Inspect** → **Console**, check `location.pathname` prints
`'/src/ui/panel.html'` (if not, pick the panel's frame in the context dropdown at
the top left), then run `bbPanel.scope` and send what it prints.

## Notes

R3 is small and prevents the most likely support question. R6 prevents the most
likely data-loss complaint.

**From T-022 (2026-11-12).** Close the open editor before calling
`list.setFilter` (`closeEditor()` in `panel.js` saves first). The list keeps an open
row through a filter change, at the top, because it holds what is being typed, but
a note from another chapter left open over a new chapter's list would confuse.

**Built 2026-11-12, In progress until the hand test.** No earlier session had
started this task; the groundwork it found was T-005's `chapter` filter, T-021's
`limit: 0` and `list.setFilter`, and T-022's `closeEditor()`.

- **How the pieces meet.** `panel-host.js` relays
  `{ bb: 'context', ref, label, versions }` from `render()`, which `content.js`
  calls at the end of every `refresh()`, so client-side navigation reaches the
  panel on the same pass that re-aligns, with no loop of its own. `label` is the
  primary column's `<h1>` (`BB.capture.headingOf`, now shared), sent only when it
  ends in the address's chapter number. `panel.js` holds the scope, the counts and
  R6's hold; `src/ui/app/scope.js` holds the rules; the worker gained a `book`
  filter, a `byVerse` prefix range like the chapter's (R8).
- **The list waits for the chapter.** `createList(…, { filter: null })` asks for
  nothing until the panel has both the stored scope and the first context, so All
  never shows for a moment first. If the host never answers, the panel gives up
  after 1s and lists All, as on a book intro.
- **A note written in the panel has no verse**, so in Chap or Book it leaves the
  list the moment it is saved. A toast says **Saved under All, as it has no
  verse.** with **Show**, which switches to All. Not in the requirements; without
  it a saved note looks lost.
- **The counts follow the list while it waits** (R6): they are for the chapter the
  list shows until it switches, so the numbers agree with the rows under them.
- **Checked in a stand-in, which ticks no box.** The real `panel.html`, `panel.js`
  and worker ran in the built-in browser on localhost against real IndexedDB, with
  a `chrome` stub and the context posted by hand (`03-task-workflow.md`). Checked
  there: the chapter list and the 3 / 7 / 8 counts; Book across chapters; All left
  alone by a move; the empty chapter and empty book texts; R9's fallback with Chap
  and Book disabled; the hold, the line and Save switching after; Keep editing
  leaving the scope alone and Discard switching it; the verse-less note's toast;
  the scope back after a reload; the header at 280px in both themes. Every box
  names the real extension on bible.com, so all wait for the user.
- **The heading and the address change together**, measured on the live page:
  **Next Chapter** on Exodus 13 changed both within one 10ms sample, 95ms after the
  click. The label check is for an order that was not seen, and costs nothing.
