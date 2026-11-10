# T-014 — Save popover: topic, tags, note body

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Done |
| Depends on | T-005, T-010, T-011, T-012, T-013 |
| Blocks | — |
| Size | M |
| Risk | Medium |

## Why

The save row has to do something. The requirement is that saving a verse lets the
user put it under an existing topic **or create a new topic inline**, add tags,
and write a note — without leaving the page or losing the selection.

This is the first place the whole capture chain is assembled into a real record.

## Scope

**In:** the popover UI, assembling the draft, sending it to the worker,
confirming.

**Out:** the panel (EPIC-02), the full page (EPIC-03), editing an existing note.

## Requirements

**R1.** Clicking the save row opens a compact popover anchored near the
selection, containing:

- the reference being saved, using `displayRef` with a `usfm` fallback
- a **topic** picker: a filterable list of existing topics, an "Uncategorized"
  default, and a **"+ New topic"** affordance that creates one inline without
  leaving the popover
- a **tag** input with autocomplete over existing tags, accepting several,
  removable as chips
- a **note body** textarea (Markdown; no toolbar here — this is the compact
  surface)
- **Save** and **Save & open panel** buttons, and Cancel

**R2.** Topics and tags come from `topics/list` and `tags/list`. Creating a topic
inline calls `topics/create` and selects the result.

**R3.** Assemble the draft by calling T-010 per selected verse, T-011 for version
identity and T-012 for `displayRef`. Send `notes/create` with the **raw draft**
— the content script does **not** generate ids, normalize tags or validate.
That is the worker's job and it must stay in one place.

**R4.** Remember the last used topic for the session and preselect it. Saving a
run of verses into one study is the common case; making the user repick each time
is the main way this flow becomes annoying.

**R5.** On success, show a brief confirmation with an **Undo**, and close. On
failure, keep the popover open with the text intact and show the error — never
discard what the user typed.

**R6.** The popover is `data-bb-own`, built with `createElement` + `textContent`,
themed with `--bb-*`, and respects `html.dark` / `html.light`.

**R7.** Keyboard: Escape closes, Enter in the tag input commits a tag,
Ctrl/Cmd+Enter saves. Focus moves into the popover on open and returns to the
trigger on close. Focus is trapped while open.

**R8.** Do not clear bible.com's verse selection when opening. The user should be
able to cancel and still have the verse selected.

**R9.** The note body is **plain Markdown source** in a textarea. No
contenteditable, no rich-text toolbar — keeping the compact surface compact is a
requirement, not an omission.

## Files

- `src/content/save-popover.js` — new. Not `menu.js`, because T-015 R6 needs this to
  work with `menu.js` removed
- `src/content/menu.js` — `onActivate` opens it
- `manifest.json` — add it before `menu.js`
- `content.css` — the popover, the toast, and the nine tokens that only `theme.css`
  had. A content script cannot load `theme.css`
- `test/save-popover.test.js` — new

## Reference

- `work/understandings/extension/02-storage-model.md` — the note and `VerseRef`
  shapes
- `work/understandings/extension/03-messaging.md` — `notes/create`,
  `topics/list`, `topics/create`, `tags/list`
- `work/understandings/extension/01-architecture.md` — rule 2, the content script
  sends raw drafts
- `work/understandings/conventions/02-css-and-theming.md`

## Acceptance

- [x] Saving a verse with a new topic, two tags and a body produces one note with
      all of it
- [x] The note holds both versions' abbr, language and text
- [x] The note holds the canonical `usfm` and the localized `displayRef`
- [x] "+ New topic" creates and selects the topic without closing the popover
- [x] Tag autocomplete offers existing tags; `Faith` and `faith` resolve to one
      tag
- [x] A Tamil tag can be typed, saved and read back unchanged
- [x] The last used topic is preselected on the next save in the same session
- [x] A worker error leaves the popover open with the typed text intact
- [x] Escape closes; Ctrl/Cmd+Enter saves; focus is trapped and restored
- [x] Cancelling leaves the verse still selected on the page
- [x] `notesRev` increments and the note appears in `notes/list`

## Notes

R4 is small and matters more than it looks. The real usage pattern is saving
several verses into one study in one sitting.

`onActivate` in `src/content/menu.js` is a stub that only logs, and this task
replaces it. A click on the save row leaves bible.com's selection and menu alone
without any `stopPropagation`, measured during T-013, which is what R8 needs.

`BB.capture.versePair` can return `primary: null`, for a verse selected in the
parallel column that the primary version does not have. `cleanSide` in
`src/shared/schema.js` refuses that with "has no primary text", and one bad verse
refuses the whole draft. Found during T-010. Decided here: the verse's one side moves
into `primary` and `parallel` is null, so the words are kept and the label stays
true. A verse with neither side still goes to the worker and is refused.

`BB.capture.displayRef(usfm, col)` answers per column, but `VerseRef.displayRef` is
one field. Ask the primary column, or the parallel column when the primary side is
null. It can return `null`, which `cleanNoteDraft` stores as `''`, and R1's `usfm`
fallback is what shows then. Found during T-012.

Three things the requirements left open, decided here. **Save & open panel** is
disabled until `BB.panel.open` exists, because the panel is EPIC-02. **Undo** moves
the note to Trash, since hard deletes happen only from there. **The session** of R4
is the tab, through `sessionStorage`.

The popover was run on live bible.com on 2026-11-10, logged out, at 1024px, 760px
and 375px and in both themes, by pasting the code into the page
(`conventions/03-task-workflow.md`) with `chrome.runtime` replaced by a stand-in that
answered as the router does. A box is ticked only if everything it describes happens
on the page and the stand-in supplied nothing but the worker's reply. Whatever
depends on what the real worker stores was checked afterwards, by hand, with the
extension installed.

`test/save-popover.test.js` passes the assembled draft through the real
`cleanNoteDraft`, which covers the shape, not the storage. `Cmd+Enter` shares a
branch with `Ctrl+Enter` and was not pressed. The last topic was preselected on
reopening, and surviving a full reload was not tried, because the pasted code does
not. The light theme was checked by swapping the class on `<html>`, which is enough
for the popover's colours and says nothing about bible.com's own.

A real-Chrome save of Exodus 13:3 on 2026-11-10 stored the right `usfm` and
`displayRef`, which is why that box is ticked. It also found two problems:

- **Fixed:** the NKJV text kept its cross-references (`Ex. 12:42; Deut. 16:3`). The
  reader's Footnotes switch was off, which renames a note's `_note` class to `_hide`,
  and `verseText` only removed `_note`. It had nothing to do with being signed in. The
  fix is in `capture.js`, here rather than in a `B-NNN` because this task's acceptance
  cannot pass without it. Its effect on `verseLabel` is outside this task and is B-011.
- **Fixed:** the Undo was not seen. The confirmation sat at the top of the viewport,
  on bible.com's search bar, dark on dark. It now appears where the popover just was.

The rest was confirmed by hand in real Chrome on 2026-11-10, with the extension
installed, signed in and with Footnotes off. A new topic, two tags and a body saved
as one note. A Tamil tag typed through an input method read back unchanged, with
Enter only confirming the composition. NKJV Exodus 13:6, which has a cross-reference,
saved with clean text. Undo was found and pressed, and `notesRev` rose by two across
one save and one Undo, so the write happened, but the note was not looked up in Trash
afterwards.

The standing regression check on a parallel chapter passed by hand the same day:
alignment, separators and the `Aa` size change. `Alt+P/A/S` were left out, as in
T-013, because they were already dead in real Chrome and B-006 tracks that.
