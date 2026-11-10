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

Read from the code. It needs the worker to answer slower than the user acts, so it was
not seen on a live page.

## Scope

**In:** what `loadLists` does when its answer arrives late.

**Out:** which row the topic list highlights, which is B-013.

## Requirements

**R1.** A topic the popover already knows about is kept when the list arrives without
it.

**R2.** The remembered topic is preselected only while nobody has picked a topic in this
popover. Picking Uncategorized counts as picking.

**R3.** The existing rule stays: no preselection over somebody typing in the topic
field.

## Files

- `src/content/save-popover.js` — `loadLists`, `pickTopic`

## Reference

- `work/requirements/EPIC-01-capture/T-014-save-popover.md` — R2 and R4

## Acceptance

- [ ] With the worker's answer delayed, a topic made inline is still in the list
      afterwards, and is still the chosen one
- [ ] With the answer delayed and nothing picked, the remembered topic is preselected
      when it arrives
- [ ] With no delay, the popover opens on the remembered topic as before
- [ ] The standing regression check passes

## Notes

**The code is changed and nothing above is verified (2026-11-10).** `loadLists` now
keeps the topics the popover already holds, and `pickTopic` sets `topicPicked`, which
`loadLists` tests before it preselects. `node --test` passes, which says only that the
file still parses where `test/save-popover.test.js` loads it. No box is ticked because
the popover was not opened in any browser after the change.

To see the first two items, the worker's answer has to be late. The stand-in worker in
`03-task-workflow.md` ("The worker can be stood in for") can hold its reply to
`topics/list` for a few seconds, which leaves time to make a topic inline first.
