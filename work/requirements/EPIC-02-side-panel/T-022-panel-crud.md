# T-022 — Inline create, edit and delete-with-undo

| Field | Value |
|---|---|
| Epic | EPIC-02 Side panel |
| Status | Done |
| Depends on | T-021 |
| Blocks | — |
| Size | M |
| Risk | Low |

## Why

The requirement is proper CRUD **in every place**, with necessary warnings. The
panel is where notes are read most, so it is where editing must be possible
without a context switch to the full page.

On warnings: a confirm dialog on every delete punishes the common case and barely
protects the rare one. **Soft delete plus an undo toast** is faster to use and
safer, because it is actually reversible. Modals are reserved for the genuinely
irreversible.

## Scope

**In:** editing, creating and trashing from the panel, with undo.

**Out:** topic and tag management (EPIC-04), Trash view (T-034), bulk actions
(EPIC-03).

## Requirements

**R1.** Clicking a row expands it in place into an editor: title, body textarea,
topic picker, tag input. **Expand in place** — do not navigate away. The panel is
narrow and a push-navigation stack would cost more room than it saves.

**R2.** **Autosave on a debounce** (~600ms) and on blur. An explicit Save button
in a panel this size is one control too many, and losing a note because the user
closed the panel is unacceptable. Show a quiet saved indicator.

> **Replaced 2026-11-12, by the user, after trying the autosave build.** "I don't
> want the end user to accidentally edit the notes wrong and miss the context of
> it." Autosave stored a slip of the keyboard at once, over the old words, with no
> moment to look at the change and no way back. Now:
>
> - **Nothing is stored until Save** (or Ctrl/Cmd+Enter). The footer says
>   "Unsaved changes" while there are any.
> - **Cancel** (or Escape) puts the note back as it was, asking first when there is
>   a change to lose. With no change the button reads **Close**.
> - **Leaving for another note, or for +, with unsaved changes asks** Save, Discard
>   or Keep editing.
> - **Unsaved changes stay in the editor while the panel is closed**: closing the
>   panel only hides its frame. A page reload does lose them; keeping a draft across
>   that is T-030 R3's.
> - **After Save the row moves to the top and is highlighted** for 1.6s, so the user
>   can see what they updated. The user found that a note jumping to the top hid
>   what had just changed.

**R3.** Send `notes/update` with a **patch**, never the whole record. Two
surfaces can have the same note open; a wholesale replace would clobber the
other's change.

**R4.** Create a standalone note (no verse attached) with a "+" in the header.
A note need not be about a verse.

**R5.** Delete is a **soft delete** via `notes/trash`, followed by an undo toast
lasting ~5 seconds. No confirm dialog. The toast's Undo calls `notes/restore`.

**R6.** The toast is dismissible, stacks sensibly if several deletes happen
quickly, and does not cover the list's last row.

**R7. Warn on genuinely irreversible or surprising actions only:**

| Action | Treatment |
|---|---|
| Delete one note | undo toast, no dialog |
| Delete several notes | confirm, with the count |
| Delete forever (Trash) | confirm, type-to-confirm |
| Discard an unsaved new note | confirm if it has content |

> **Amended 2026-11-12, with the user.** "Delete several notes" has no selection
> to start from in the panel, and bulk actions are EPIC-03's (T-027). The count
> confirm is built into the one shared trash path, `moveToTrash` in
> `src/ui/app/trash.js`, which asks whenever it is given two or more notes. Until
> T-027 hands it a selection it is reached from the panel's Console as
> `bbPanel.trash(ids)`, and the Acceptance box says so. "Delete forever" is the
> Trash view's, which is out of scope here, so type-to-confirm arrives with T-034.

**R8.** Conflict handling: if `notesRev` reports this note changed elsewhere
while it is open and dirty, show a non-blocking notice offering to reload. Do not
silently overwrite, and do not block the user's typing.

> **As built, 2026-11-12.** The notice offers **Reload** (take theirs) and **Keep
> mine** (leave yours on screen). With R2's Save button nothing is written either
> way until Save, and Save then sends only the fields that differ from what is
> stored now, so a field the other surface changed and this one did not is kept.

**R9.** The editor is a **plain textarea of Markdown source** — no
contenteditable, no formatting toolbar. The toolbar lives in the full page
(EPIC-03) where there is room.

**R10.** Escape collapses the editor (after autosave has flushed). Ctrl/Cmd+Enter
collapses and saves immediately.

> **Amended 2026-11-12, with R2.** Escape is Cancel: it collapses the editor and
> keeps nothing unsaved, asking first if there is a change. Ctrl/Cmd+Enter is Save.

**R11.** *(Added 2026-11-12, by the user.)* A note's title shows in its row. A note
with a verse keeps the reference on the first line, and its title starts the
two-line preview in bold ("Firstborn — Consecrate to Me…"), so the row keeps its
one fixed height. A note with no verse already shows its title as its reference.

## Files

- `src/ui/app/editor.js`, `src/ui/app/toast.js`, `src/ui/app/dialog.js` — new,
  shared with the full page
- `src/ui/app/suggest.js` — new, the save popover's topic and tag combobox as an
  ES module; `src/ui/app/trash.js` — new, the one trash-with-undo path
- `src/ui/app/list.js` — the open row: one taller row, held in place
- `src/ui/panel.js`, `src/ui/panel.html` (the **+** button), `src/ui/ui.css`
- `src/content/save-popover.js` — a comment pointing at its copy in `suggest.js`
- `content.css` — the dock moves clear of the open panel (B-022, found in this
  task's hand test)
- `test/editor.test.js` — new; `test/save-popover.test.js` — the two `startRow`
  copies held together

## Reference

- `work/understandings/extension/03-messaging.md` — `notes/update` patches,
  `notes/trash`, `notes/restore`, `notesRev`
- `work/understandings/extension/02-storage-model.md` — soft delete is the only
  delete in normal use
- `work/understandings/conventions/02-css-and-theming.md`

## Acceptance

- [x] Clicking a row expands it in place; typing stores nothing until Save, and
      Cancel puts the note back as it was
- [x] After Save the note moves to the top and its row is highlighted
- [x] Leaving a note with unsaved changes asks Save, Discard or Keep editing
- [x] Closing the panel mid-edit keeps the unsaved change in the editor
- [x] A note's title shows in its row (R11)
- [x] Deleting shows an undo toast; Undo restores the note with topic and tags
      intact
- [x] Letting the toast expire leaves the note in Trash, not purged
- [x] Editing the same note in the full page and the panel: the second surface
      shows a conflict notice rather than clobbering
- [x] A standalone note with no verse can be created and saved
- [x] Trashing three notes at once asks for confirmation with the count (from
      the panel's Console with `bbPanel.trash`, until T-027 brings selection)
- [x] Escape and Ctrl/Cmd+Enter behave as specified
- [x] Enter on a focused row expands it, as a click does (moved from T-021)
- [x] `notesRev` increments on every operation
- [x] At 280px the editor is still usable

## Test it by hand

Rewritten 2026-11-12 for the Save button, the titles in rows and B-022.

Several steps use the panel's Console. Right-click inside the panel → **Inspect**,
then the **Console** tab. Run `location.pathname`: it must print
`'/src/ui/panel.html'`. If it prints the bible.com path, pick the panel's frame in
the context dropdown at the Console's top left. Each snippet goes in on one line, as
given.

1. **Load the change.** `chrome://extensions` → BibleBoost → the reload arrow, then
   reload every bible.com tab that was open.
2. **Starting state.** A maximised window on
   `https://www.bible.com/bible/339/EXO.13.TAOVBSI?parallel=114`, either theme.
   Click the slim **B** tab on the right edge. The dock (**Parallel**, **Align
   verses**) moves left, to just beside the panel, and covers no part of it. You
   need at least six notes, one with a topic and two tags. If you have fewer, save
   some first: tap a verse → **Save to BibleBoost** → pick a topic, add two tags →
   **Save**.
3. Click the text of a row in the middle of the list (not its trash icon). It opens
   where it is into an editor: **Title (optional)**, the note in a box, **Topic**,
   **Tags**, and at the bottom **Close** and a blue **Save**. Type `Firstborn` in
   **Title** and a few words at the end of the note. The bottom left says **Unsaved
   changes**, and **Close** now reads **Cancel**. Wait five seconds: nothing else
   happens. Press **Escape**: a box asks **Discard your changes?** with **Keep
   editing** and **Discard**. Click **Discard**: the row closes exactly as it was,
   where it was. → Acceptance: Clicking a row expands it in place; typing stores
   nothing until Save, and Cancel puts the note back as it was
4. Open the same row again, type the title and words again, and click **Save**. The
   editor closes, the list goes to the top, and that note is first, lit up blue for
   a moment. Its row now shows **Firstborn** in bold at the start of the preview,
   then your note. → Acceptance: After Save the note moves to the top and its row is
   highlighted; A note's title shows in its row (R11)
5. Open another row, add a word, and press **Ctrl+Enter** (**Cmd+Enter** on a Mac):
   it saves and closes the same way. Open one more, add a word, and press
   **Escape**, then **Discard**: nothing is saved.
   → Acceptance: Escape and Ctrl/Cmd+Enter behave as specified
6. Open a row and add a word. Without saving, click a different row. A box asks
   **Save your changes?** with **Keep editing**, **Discard** and **Save**. Click
   **Save**: the first note is saved, and the row you clicked opens.
   → Acceptance: Leaving a note with unsaved changes asks Save, Discard or Keep editing
7. With that row open, press **Escape**: it closes and keeps a blue outline. Press
   **↓** twice, then **Enter**: that row opens with the caret in the note. Press
   **Escape**.
   → Acceptance: Enter on a focused row expands it, as a click does (moved from T-021)
8. Open a row, type `closing test`, and click the panel's **×**. Click the **B** tab
   to open the panel again: the editor is still open with "closing test" in it and
   **Unsaved changes**. Click **Save**.
   → Acceptance: Closing the panel mid-edit keeps the unsaved change in the editor
9. Point at the row with a topic and two tags, and click its trash icon. The row goes,
   and a bar at the bottom of the panel says **Note moved to Trash** with **Undo** and
   **×**, none of it under the dock. Click **Undo** within five seconds: the note
   comes back where it was, with the same topic dot and tags, and the bar says **Note
   restored**. → Acceptance: Deleting shows an undo toast; Undo restores the note with
   topic and tags intact
10. Trash a note you can spare, and leave the bar alone for six seconds: it goes away
    by itself. In the Console run
    `const { notes: [binned] } = await chrome.runtime.sendMessage({ type: 'notes/list', filter: { trashed: true }, page: { limit: 1 } }); binned.body`
    It prints that note's text, so it is in Trash and not gone. Bring it back with
    `await chrome.runtime.sendMessage({ type: 'notes/restore', ids: [binned.id] })`
    and it reappears in the list.
    → Acceptance: Letting the toast expire leaves the note in Trash, not purged
11. **A change from elsewhere.** The full page does not exist until T-025, so a write
    from the Console stands in for it: it goes through the worker exactly as another
    surface's would. Open a note and type a word in it, without saving. In the Console
    run
    `{ const noteId = document.querySelector('.bb-row[data-bb-open]').dataset.id; chrome.runtime.sendMessage({ type: 'notes/update', id: noteId, patch: { body: 'Changed in another tab' } }); }`
    A box appears in the editor: **This note was changed elsewhere while you were
    editing it.**, with **Reload** and **Keep mine**, and the bottom left says
    **Changed elsewhere**. Your text is still on screen. Click **Reload**: the note
    reads "Changed in another tab". Type a word again, run the snippet again, and this
    time click **Keep mine**, then **Save**: your text is what the row shows.
    → Acceptance: Editing the same note in the full page and the panel: the second
    surface shows a conflict notice rather than clobbering
12. Click the **+** at the top of the panel. A row headed **New note** opens at the
    top. Type only a title: the bottom left says **Write some text to save this
    note** and **Save** is dimmed. Type `A note with no verse` in the note box and
    click **Save**: the row stays at the top, lit up, headed by your title. Click
    **+** again, type only a title, and press **Escape**: **Discard this note?**
    asks, and **Discard** removes it.
    → Acceptance: A standalone note with no verse can be created and saved
13. In the Console run
    `const { notes: three } = await chrome.runtime.sendMessage({ type: 'notes/list', page: { limit: 3 } }); await bbPanel.trash(three.map((n) => n.id));`
    A box asks **Move 3 notes to Trash?**, with **Cancel** outlined. Click **Move to
    Trash**: the three top notes go, and the bar says **3 notes moved to Trash**.
    Click **Undo**: all three come back and the bar says **3 notes restored**.
    → Acceptance: Trashing three notes at once asks for confirmation with the count
14. In the Console run `(await chrome.storage.local.get('notesRev')).notesRev` and
    note the number. Open a note, type a word, click **Save**, and run it again: one
    higher. Open a note, type, and **Cancel** → **Discard**: unchanged. Trash a note
    with its icon: one higher. **Undo**: one higher again.
    → Acceptance: `notesRev` increments on every operation
15. Drag the panel's left edge as far right as it goes (280px). The dock follows to
    stay beside the panel once you let go. Open a note with several tags and add two
    long ones: the pills wrap inside the Tags box and the rows below move down.
    **Cancel** and **Save** both fit at the bottom. Click into **Topic**: a list opens
    under it with Uncategorized, your topics and **+ New topic: type a name**.
    Nothing scrolls sideways. → Acceptance: At 280px the editor is still usable
16. **The dock (B-022).** Pin the panel with its pin button, then unpin it: either
    way the dock stays beside the panel and off it. Click the panel's **×**: the dock
    goes back to the window's bottom-right corner. → B-022's Acceptance
17. **Standing regression** on `/bible/339/EXO.13.TAOVBSI?parallel=114`: verses
    align, separators draw, the dock's **Parallel** and **Align verses** work, so do
    `Alt+P` / `Alt+A` / `Alt+S`, and changing the reader's "Aa" size re-aligns.

On a failure, send the step number and what you saw instead, a screenshot, and
anything red in the panel's Console.

## Notes

**Checked by hand by the user, 2026-11-12.** The user reported all 17 steps of the
guide above passing in their own Chrome, standing regression included, after the
rework to a Save button. Every Acceptance box was ticked from that report. Step 11's
change from elsewhere was a Console write standing in for the full page, which does
not exist until T-025.

R3 is easy to get wrong and hard to notice: sending the whole record works
perfectly until two surfaces are open, which is exactly the configuration this
project is building toward.

**What T-021 left for this task (2026-11-11).**

- `createList(host, { onOpen })` in `src/ui/app/list.js` calls `onOpen(note)` for
  Enter on a row and for a click on one. `panel.js` passes nothing yet, so both do
  nothing. That hook is where R1's editor goes, and Enter on a row expanding it is
  this task's to check, moved here from T-021's keyboard box.
- **The list is virtual above 200 rows and assumes every row is one height**
  (78px, read off a real row; `ui.css` explains why). Expanding a row in place
  breaks that, so the list has to learn one taller row at the open index before R1
  works on a long list. Rows after it move down by the difference.
- Delete already exists: the row's trash button and the Delete key send
  `notes/trash` with no Undo, by the user's choice for T-021. R5's toast goes on
  top of that, and the hand test meanwhile restores with `notes/restore` from the
  console.
- The list moves an edited note to the top, because it is now the newest by
  `updatedAt`. A note being edited in place would jump on the first autosave.
  Decide here whether the open row stays put until it closes.

**Decided with the user, 2026-11-12.**

- **The open row stays put while it is open**, and on closing takes its sorted place
  (the top, if it was edited), with focus going with it. A row clicked while another
  is open stays under the pointer as the old one shrinks, wherever there is scroll
  room for that (at the very top of the list there is none, and it moves up).
- **Several notes at once** go through `moveToTrash` with a count confirm, reached
  from the Console until T-027; see R7's amendment.
- **Topic and tags** use the save popover's own combobox, ported to
  `src/ui/app/suggest.js`, so "+ New topic" works here too.
- The T-019 to T-021 work was to be committed first. It already was, as `f254555`.

**Built 2026-11-12. No box is ticked**: each names the panel in the real extension,
which is the user's Chrome.

- **`list.js` keeps the worker's order and draws a different one.** The model `ids`
  is untouched by an open editor, so paging, patching and the `OVERTAKE_MS` reloads
  work as before. A display mapping lifts the open note out and puts it after its
  *anchor*, the note above it when it opened. A neighbour and not a position, so a
  note created above moves the open row down with its neighbours; if the anchor is
  trashed, or edited elsewhere and jumps to the top, the open row re-anchors to the
  next note up and does not follow it.
- **One taller row.** `topOf` adds the open row's extra height to every row after
  it, and `windowRange` inverts that. The height is re-read on every draw as well as
  by a `ResizeObserver`, because the observer never fired in the built-in browser
  with its pane hidden and the next row overlapped by 72px until something redrew.
- **The open row is never dropped**: not by the virtual window, and not when its
  note is trashed elsewhere. Then the list calls `onGone`. With unsaved changes the
  panel asks whether to keep them in the note in Trash (the worker accepts an update
  there) so that Undo brings them back, closes the editor, and offers Undo.
- **Saving (as reworked the same day, see below)** sends `diffPatch(base, local)`,
  only the fields that differ, and only on Save or Ctrl/Cmd+Enter. Every other way
  out goes through `close({ how })` in `editor.js`: `cancel` asks before dropping a
  change, `ask` (another note, or +) offers Save, Discard or Keep editing, and
  `discard` is for a note about to go to Trash. Nothing is ever saved by a message
  from the host, since nothing that arrives by `postMessage` may cause a write.
- **R8 is per field.** `mergeRemote(base, local, remote)` takes a change from
  elsewhere quietly when that field is untouched here, and calls it a conflict only
  when it is being edited here too. The base becomes theirs either way, so a later
  Save sends exactly the fields that differ from what is stored now.
- **A saved row is highlighted** (`data-bb-flash`, 1.6s, `flashRow` in `list.js`)
  where it lands, which for an edit is the top. Focus goes there too, but a focus
  from script shows no outline after a mouse click, so the highlight is what shows
  the user which row changed. A new note saved a moment ago may not be on the list
  yet, since its create signal can come after the reply, and then the highlight
  waits for it through `focusPending()`.
- **Titles in rows (R11)** are a `<strong>` at the start of the preview, so the
  two-line clamp and the fixed row height are untouched.
- **`dialog.js` answers from its buttons and Escape directly.** It first waited for
  the dialog's `close` event, which never arrived in the hidden pane, and the panel's
  queue of actions stopped behind it for good.
- **The toast stack is in the flow under the list**, so it shortens the list rather
  than covering the last row. Capped at three, the timer re-arms while hovered or
  focused, as the popover's does. That much of T-035 is here; see its Notes.

**The user's first look, 2026-11-12, changed three things.**

- **Autosave went, for a Save button** (R2 as replaced). The user: autosave lets an
  end user "accidently edit the notes wrong and miss the context of it", and a note
  jumping to the top on save hid what had changed. Options put to the user were a
  Save button, or autosave with a Revert and an undo toast; they chose Save.
- **Titles were nowhere in the list** for a note with a verse: T-021 shows a title
  only in place of a missing reference. Added as R11; no later task covered it.
- **The dock covered the toast's Undo**, and in fact the whole bottom-right corner
  of the open panel. Fixed in `content.css` as B-022, which has its own Acceptance.

**Checked through a stand-in on 2026-11-12** (real panel, real worker, real
IndexedDB on localhost, with a `chrome` stub; the recipe is in
`03-task-workflow.md`). That proves the code's logic and nothing about the extension
in Chrome, so it ticks nothing. Twice: once for the autosave build, and again after
the rework.

After the rework:

- Typing in an open row, and waiting, wrote nothing; the footer said "Unsaved
  changes" and Close became Cancel. Escape asked "Discard your changes?" with Keep
  editing focused, and Discard left the stored note as it was, in place.
- Save sent one `notes/update` carrying `{ body }` only, closed the editor, and the
  note was first, focused and highlighted; the highlight was gone after 1.6s.
- Clicking another row with changes asked Save, Discard or Keep editing with Save
  focused; Save stored it, highlighted it at the top, and opened the clicked row.
- A new note: a title alone dimmed Save and said what was missing; text and
  Ctrl+Enter created it as a `panel` note with no verse, first and highlighted.
- A change from elsewhere while dirty showed the notice and "Changed elsewhere", and
  left the stored text alone; Save then sent only `{ body }`, keeping their title.
- Trashing an open note with unsaved changes dropped them without asking, and Undo
  brought back the note as last saved. Trashed elsewhere with changes, it asked, and
  Keep them saved the words into the note in Trash.
- Titles showed bold at the start of the preview, in full colour before a muted
  verse, and not twice for a note with no verse.
- With the real `content.css` at 1400px, the dock sat 20px from the window's edge
  with the panel hidden, 20px left of the panel at 30% and at 45%, and back in the
  corner when it was hidden again. It never overlapped the panel.

From the autosave build, still true of the code that did not change:

- Enter opened a focused row. Delete, arrows, Home and End typed in the body neither
  trashed nor moved anything.
- Trash then Undo restored topic and both tags in place; focus went to the restored
  row when Undo held it. Four quick deletes stacked three toasts, and once they
  expired all four notes were in Trash, not purged.
- `bbPanel.trash` of three asked "Move 3 notes to Trash?" with Cancel focused;
  Cancel and Escape changed nothing; Move to Trash and Undo moved and restored all
  three.
- With 313 notes (24 rows in the DOM), row 150 opened and stayed between the same
  neighbours with the next row flush below it, through a create, an edit of its
  anchor and a trash of its anchor elsewhere. Closed, it landed in its sorted place
  with the first five rows matching the worker.
- `notesRev` rose by exactly one per create, update, trash and restore, and not at
  all for a close with nothing to send.
- At 280px nothing scrolled sideways or stood out of the row, and five tags wrapped.

What the stand-in could not show: focus events from `focus()` (the topic list
opening on focus), the observer-driven redraw while typing, closing the panel
through the real host, and the dock on a real bible.com page. Those are steps 8, 15
and 16 above.
