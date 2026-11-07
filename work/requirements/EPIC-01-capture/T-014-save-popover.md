# T-014 — Save popover: topic, tags, note body

| Field | Value |
|---|---|
| Epic | EPIC-01 Capture |
| Status | Not started |
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

- `src/content/menu.js` or a new `src/content/save-popover.js`
- `src/shared/theme.css`

## Reference

- `work/understandings/extension/02-storage-model.md` — the note and `VerseRef`
  shapes
- `work/understandings/extension/03-messaging.md` — `notes/create`,
  `topics/list`, `topics/create`, `tags/list`
- `work/understandings/extension/01-architecture.md` — rule 2, the content script
  sends raw drafts
- `work/understandings/conventions/02-css-and-theming.md`

## Acceptance

- [ ] Saving a verse with a new topic, two tags and a body produces one note with
      all of it
- [ ] The note holds both versions' abbr, language and text
- [ ] The note holds the canonical `usfm` and the localized `displayRef`
- [ ] "+ New topic" creates and selects the topic without closing the popover
- [ ] Tag autocomplete offers existing tags; `Faith` and `faith` resolve to one
      tag
- [ ] A Tamil tag can be typed, saved and read back unchanged
- [ ] The last used topic is preselected on the next save in the same session
- [ ] A worker error leaves the popover open with the typed text intact
- [ ] Escape closes; Ctrl/Cmd+Enter saves; focus is trapped and restored
- [ ] Cancelling leaves the verse still selected on the page
- [ ] `notesRev` increments and the note appears in `notes/list`

## Notes

R4 is small and matters more than it looks. The real usage pattern is saving
several verses into one study in one sitting.
