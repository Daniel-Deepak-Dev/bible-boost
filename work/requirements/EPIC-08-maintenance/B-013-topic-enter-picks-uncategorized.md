# B-013 — Enter in the save popover's Topic field picks Uncategorized

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

Focusing the Topic field opens its list (`save-popover.js`, the `focus` listener in
`build`). `open()` in `suggestionList` then highlights the row `startRow` names, and
`startRow` answered with the first row that is not a hint:

```js
return rows.findIndex((r) => !r.hint);
```

`topicRows` always puts `UNCATEGORIZED` first, so with nothing typed the highlighted
row is always Uncategorized, whatever the field currently holds.

So: the last topic was "Faith", and the popover opens with Faith preselected. The user
tabs into Topic and presses Enter to accept it. `onKey` picks `rows[active]`, the topic
becomes Uncategorized, and on save `rememberTopic(null)` removes the remembered topic,
so the next popover opens on Uncategorized as well. Nothing on screen says any of this
happened except the name in the field changing.

Filed from the code. Reproduced on 2026-11-11 in a harness page running the real
`save-popover.js` (see Notes).

## Scope

**In:** which row is highlighted when the topic list opens.

**Out:** the tag list, which passes no `autoActive` and highlights nothing.

## Requirements

**R1.** When the list opens unfiltered, which is when the field still reads as the
current choice, Enter must leave the current choice as it is.

**R2.** When the user has typed a filter, the first matching row is highlighted, as it
is now, so that typing "fai" and pressing Enter still picks Faith.

**R3.** `suggestionList` stays generic. It is shared with the tag list and must not
learn what a topic is.

## Files

- `src/content/save-popover.js` — `startRow`, and `topicRows`, which marks the row
- `test/save-popover.test.js` — `startRow`'s cases

## Reference

- `work/requirements/EPIC-01-capture/T-014-save-popover.md` — R4 and R7

## Acceptance

- [x] With Faith preselected, Tab into Topic and Enter leaves Faith chosen
- [x] Typing "fai" and Enter picks Faith
- [x] ArrowDown and ArrowUp still step through every row from wherever the highlight
      starts
- [x] After a save, the next popover opens on the topic that was saved to

## Test it by hand

About five minutes, in your own Chrome with the unpacked extension. Every box above is
already ticked from the harness (see Notes). These steps confirm the fix on bible.com and
run the standing regression, which is what keeps this file `In progress`.

**Load the change**

1. Open `chrome://extensions`, find **BibleBoost**, and click its reload arrow. Then
   reload every bible.com tab that was already open, because a content script does not
   update in a tab loaded before the reload.
2. Open `https://www.bible.com/bible/339/EXO.13.TAOVBSI?parallel=114` in a window wider
   than 768px.

**Give the popover a topic to remember**

3. Tap verse 2 in the left (Tamil) column. In bible.com's verse menu that rises at the
   bottom, click **Save to BibleBoost**, the row between Highlight and Copy. **Expect:**
   the save popover opens, with the cursor in the note box.
4. Click the **Find or create a topic** field and pick any topic except Uncategorized.
   These steps call it Faith. If you have none, type `Faith` and pick
   **+ New topic "Faith"**, which keeps it in your topics afterwards. Click **Save**, then
   **Undo** in the message that appears, so no note is left behind. **Expect:**
   **Saved to Faith**, then **Moved to Trash**.

**The fix**

5. If bible.com's verse menu has gone, tap a verse in the left column to bring it back.
   Click **Save to BibleBoost**. **Expect:** the topic field already reads **Faith**.
   → Acceptance: After a save, the next popover opens on the topic that was saved to
6. Press `Shift`+`Tab` twice, which moves from the note box through Tags into the topic
   field. **Expect:** the list drops down with **Faith** highlighted, not Uncategorized
   at the top.
   → Acceptance: With Faith preselected, Tab into Topic and Enter leaves Faith chosen
7. Press `Enter`. **Expect:** the list closes and the field still reads **Faith**.
   → Acceptance: With Faith preselected, Tab into Topic and Enter leaves Faith chosen
8. Press `Ctrl`+`A` to select the name, then type its first three letters, `fai` for
   Faith. **Expect:** the list keeps only the topics containing them, ends with
   **+ New topic "fai"**, and highlights the first topic. Press `Enter`. **Expect:** the
   field reads that topic's name, and no topic called "fai" was made.
   → Acceptance: Typing "fai" and Enter picks Faith
9. Press `Escape` twice to close the list and then the popover.

**Standing regression**

10. On the same page at full width, check each of these:
    - Verse numbers line up across the two columns.
    - With separators on, a faint line runs between the verse rows. Turn them on with the
      popup's **Verse separators** switch if they are off.
    - **Left** `Alt` + `P`, `Alt` + `A` and `Alt` + `S` toggle parallel, alignment and
      separators. Click in the right column first.
    - After changing the text size with the reader's **Aa** button at the top, the columns
      line up again.

    If the `Alt` keys do nothing while the dock's switches work, that is B-006, not this
    change.

**If a step fails**, send its number and what you saw instead. For step 6, a screenshot of
the open list helps; for anything else, the Console output from the **BibleBoost** context
(DevTools, Console, the context menu at the top left).

## Notes

**Fixed and checked in a harness, 2026-11-11.** `startRow` now starts on the row its owner
marks `{ current: true }`, and only falls back to the first row that is not a hint when
there is none. `topicRows` already marked the current topic's row, and only while nothing is
filtered, which is what keeps R2: once somebody types, no row is current and the first
match leads. `suggestionList` still knows nothing about topics (R3). `current` was already
part of its documented row shape. `startRow` is exposed on `BB.savePopover.debug`, and
`test/save-popover.test.js` covers it. Its first case returns 0 under the old rule, so it
fails on this bug. `node --test`: 237 pass.

The four ticks come from a throwaway page on localhost, in the Claude desktop app's
built-in browser. It loaded the working copy's `save-popover.js` and `content.css`, with
`BB.dom`, `BB.capture` and `chrome.runtime.sendMessage` stood in for (see
`03-task-workflow.md`, "A local stand-in page" and "The worker can be stood in for"). Real
key presses drove it. The same page served the file with the one line reverted, behind
`?old=1`, and ran the same steps:

| Step | Old | New |
|---|---|---|
| Faith remembered, `Shift`+`Tab` ×2 into Topic | Uncategorized highlighted | Faith highlighted |
| `Enter` | field reads Uncategorized | field reads Faith |
| `Ctrl`+`Enter` to save, then open again | saved `topicId: null`, `bb-last-topic` removed, opens on Uncategorized | saved `tFaith`, opens on Faith |

With Hope remembered, the highlight started on Hope. `ArrowDown` went Uncategorized, Faith,
Hope, and `ArrowUp` went Faith, Uncategorized, Hope, skipping the hint both ways. Typing
`fai` left Faith and **+ New topic "fai"** with Faith highlighted, and `Enter` chose Faith
without making a topic.

The harness proves the popover's own logic and nothing about bible.com. The boxes are
about the popover alone, so they are ticked. What it leaves is the standing regression on a
live parallel chapter, which AGENTS.md asks for after any page-side change, and that is why
this file is not `Done`. The guide above covers it.
