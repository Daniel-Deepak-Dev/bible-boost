# B-017 — The save popover's late lists overwrite what the user already did

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | In progress |
| Type | Found by the review of T-014 |
| Blocks release | No |
| Depends on | T-014 |
| Size | S |
| Risk | Low |

## The problem

The popover appears at once and asks the worker for the topics and tags afterwards
(`loadLists` in `src/content/save-popover.js`). When the worker has to be started
first, the answer can arrive after the user has already acted, and two lines then undid
what they had done:

```js
if (topics.ok) here.topics = topics.topics;
...
if (last && document.activeElement !== here.topicInput) chooseTopic(last);
```

- **The list was replaced.** A topic made inline before the answer arrived had been
  pushed into `here.topics` by `pickTopic`. A `topics/list` that the worker answered
  before that topic existed does not hold it, so it vanished from the list.
- **The choice was replaced.** The remembered topic was put in whenever focus was not in
  the topic field. Somebody who had made "Hope", moved on to the note and was typing
  there had Hope swapped for the remembered "Faith", and the note went to Faith.
- **An open list was left as it was.** Found by the 2026-11-10 review of EPIC-00 and
  EPIC-01.
  Somebody who tabbed into Topic before the answer saw Uncategorized alone, and went on
  seeing it after the topics had arrived, until they typed. Typing "fai" in that gap
  highlighted **+ New topic "fai"**, and that stayed highlighted when Faith arrived, so
  Enter made a topic called "fai".

Read from the code. It needs the worker to answer slower than the user acts, so it was
not seen on a live page.

## Scope

**In:** what `loadLists` does when its answer arrives late.

**Out:** which row the topic list highlights when it opens, which is B-013.

## Requirements

**R1.** A topic the popover already knows about is kept when the list arrives without
it.

**R2.** The remembered topic is preselected only while nobody has picked a topic in this
popover. Picking Uncategorized counts as picking.

**R3.** The existing rule stays: no preselection over somebody typing in the topic
field.

**R4.** A topic list that is open when the answer arrives is drawn again from it. A row
the user moved the highlight to with the arrow keys stays highlighted if it is still
listed.

## Files

- `src/content/save-popover.js` — `loadLists`, `pickTopic`, and `refresh` in
  `suggestionList`

## Reference

- `work/requirements/EPIC-01-capture/T-014-save-popover.md` — R2 and R4

## Acceptance

- [x] With the worker's answer delayed, a topic made inline is still in the list
      afterwards, and is still the chosen one
- [x] With the answer delayed and nothing picked, the remembered topic is preselected
      when it arrives
- [x] With no delay, the popover opens on the remembered topic as before
- [x] With the answer delayed and the topic list already open, the list fills in when
      the answer arrives, and a row reached with the arrow keys keeps the highlight
- [ ] The standing regression check passes

## Test it by hand

About three minutes, in your own Chrome with the unpacked extension. Only the last box is
left. The delayed-answer boxes were checked in a harness that can hold the worker's reply
back (see Notes), which an ordinary Chrome cannot do on demand.

**Load the change**

1. Open `chrome://extensions`, find **BibleBoost**, and click its reload arrow. Then
   reload every bible.com tab that was already open, because a content script does not
   update in a tab loaded before the reload.
2. Open `https://www.bible.com/bible/339/EXO.13.TAOVBSI?parallel=114` in a window wider
   than 768px.

**The ordinary path still works**

3. Tap verse 2 in the left (Tamil) column, and in bible.com's verse menu click
   **Save to BibleBoost**. Pick any topic except Uncategorized, click **Save**, then
   **Undo**. Bring the menu back by tapping a verse if it has gone, and click
   **Save to BibleBoost** again. **Expect:** the topic field already reads the topic you
   picked. Press `Escape` to close the popover. This only confirms the box ticked from
   the harness. No box hangs on it.

**Standing regression**

4. On the same page at full width, check each of these:
   - Verse numbers line up across the two columns.
   - With separators on, a faint line runs between the verse rows. Turn them on with the
     popup's **Verse separators** switch if they are off.
   - **Left** `Alt` + `P`, `Alt` + `A` and `Alt` + `S` toggle parallel, alignment and
     separators. Click in the right column first.
   - After changing the text size with the reader's **Aa** button at the top, the columns
     line up again.

   If the `Alt` keys do nothing while the dock's switches work, that is B-006, not this
   change.
   → Acceptance: The standing regression check passes

**If a step fails**, send its number and what you saw instead, with the Console output from
the **BibleBoost** context (DevTools, Console, the context menu at the top left).

## Notes

**The code is changed and nothing above is verified (2026-11-10).** `loadLists` now
keeps the topics the popover already holds, and `pickTopic` sets `topicPicked`, which
`loadLists` tests before it preselects. `node --test` passes, which says only that the
file still parses where `test/save-popover.test.js` loads it. No box is ticked because
the popover was not opened in any browser after the change.

**R4 added and everything but the regression checked, 2026-11-11.** `suggestionList`
gained `refresh()`, which redraws only a list that is already open, and `loadLists` calls
it for the topic list once the topics are merged. A highlight `open()` placed is placed
again from the new rows. One the arrow keys put there is kept by its label. The tag list
needs no refresh, because with no known tags it has no rows and closes, so it cannot be
open before the answer.

Checked on a throwaway localhost page in the Claude desktop app's built-in browser. It ran
the working copy's `save-popover.js` with a stand-in worker that answered `topics/list`
and `tags/list` 6 s late, with the topics as they stood when it was asked. Real key
presses drove it. `?old=1` served the same file with the `refresh()` call and B-013's
line reverted.

| Run, Faith remembered | Old | New |
|---|---|---|
| `Shift`+`Tab` into Topic early, wait | list stays `Uncategorized \| + New topic: type a name` | becomes `Uncategorized \| Faith \| Hope \| + New topic: type a name` |
| Same, then type `fai` early, wait | `+ New topic "fai"` still the only row, highlighted | `Faith \| + New topic "fai"`, Faith highlighted |

New code only:

- Made Grace inline, opened the list with `ArrowDown` and moved to Uncategorized with
  `ArrowUp`, then waited. Uncategorized stayed highlighted, Grace stayed chosen, and the
  list grew to `Uncategorized | Faith | Hope | Grace | …`. → box 4.
- Made Grace inline and tabbed on to the note, then waited. The field still read Grace,
  and Topic, focused again, listed Grace with it highlighted. → box 1.
- Did nothing: Uncategorized at open, Faith once the answer arrived. → box 2.
- No delay: the popover read Faith at open. → box 3.
- In every delayed run with focus in Topic, the field was not overwritten (R3).

The stand-in proves the popover's logic and nothing about the real worker's timing or
bible.com. The standing regression on a live parallel chapter is the one box left.
