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
`build`). `open()` in `suggestionList` then highlights the first row that is not a
hint:

```js
active = autoActive ? rows.findIndex((r) => !r.hint) : -1;
```

`topicRows` always puts `UNCATEGORIZED` first, so with nothing typed the highlighted
row is always Uncategorized, whatever the field currently holds.

So: the last topic was "Faith", and the popover opens with Faith preselected. The user
tabs into Topic and presses Enter to accept it. `onKey` picks `rows[active]`, the topic
becomes Uncategorized, and on save `rememberTopic(null)` removes the remembered topic,
so the next popover opens on Uncategorized as well. Nothing on screen says any of this
happened except the name in the field changing.

Read from the code. Not reproduced on a live page.

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

- `src/content/save-popover.js` — `suggestionList` and `topicRows`

## Reference

- `work/requirements/EPIC-01-capture/T-014-save-popover.md` — R4 and R7

## Acceptance

- [ ] With Faith preselected, Tab into Topic and Enter leaves Faith chosen
- [ ] Typing "fai" and Enter picks Faith
- [ ] ArrowDown and ArrowUp still step through every row from wherever the highlight
      starts
- [ ] After a save, the next popover opens on the topic that was saved to
