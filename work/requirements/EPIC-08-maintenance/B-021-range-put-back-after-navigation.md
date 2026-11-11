# B-021 — Closing the save popover puts back a text selection whose page is gone

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Found by the 2026-11-10 review of EPIC-00 and EPIC-01 |
| Blocks release | No |
| Depends on | T-015 |
| Size | S |
| Risk | Low |

## The problem

A text selection does not survive the popover: `showModal()` collapses it. So
`src/content/quickbar.js` clones the range before the popover opens and puts it back
when the dialog closes (`keepAcrossPopover`, T-014 R8):

```js
dialog.addEventListener('close', () => {
  if (range) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  follow(getSelection());
}, { once: true });
```

The function's own comment says bible.com can navigate underneath the dialog, and
`06-verse-action-menu.md` records it happening: narrowing the window dropped
`?parallel=114` by client-side navigation while the popover was open. When that
replaces the verse the range was over, the clone points into nodes that are no longer
in the page, and `addRange` is handed a range from a detached tree.

The Selection API ignores a range whose root is not the document, so nothing is
selected and nothing breaks. `follow(getSelection())` then reads the page afresh and
hides the chip. Chromium is expected to log a console warning for the ignored range as
well. That last part comes from memory of Chromium's source and was not seen.

Read from the code. Not reproduced. The one recorded trigger was a 375px window, which
is no longer a target width (AGENTS.md, Target screens). Where bible.com drops
`?parallel=` at tablet widths is still open (T-018), and a chapter change under the
dialog would do the same.

## Scope

**In:** what `keepAcrossPopover` does with a range whose nodes have left the page.

**Out:** the tap selection, which is a class on the verse and is never put back.
Anything about the popover itself.

## Requirements

**R1.** A range is put back only if both of its ends are still in the page.

**R2.** When it is not put back, the chip still follows whatever the page holds now, as
it does today.

## Files

- `src/content/quickbar.js` — `keepAcrossPopover`

## Reference

- `work/understandings/bible-com/06-verse-action-menu.md` — "bible.com can navigate
  underneath it" and "A text selection does not survive it"
- `work/requirements/EPIC-01-capture/T-015-quickbar-fallback.md`
- `work/requirements/EPIC-01-capture/T-014-save-popover.md` — R8

## Acceptance

- [ ] Cancelling the popover after a text drag over a verse still leaves that text
      selected
- [ ] With the dragged-over verse replaced while the popover is open, closing it logs no
      selection warning in the Console, and the chip is hidden
- [ ] The standing regression check passes

## Notes

The fix is expected to be a guard on `range.startContainer.isConnected` and
`range.endContainer.isConnected` around the two selection calls. Whether
`removeAllRanges()` belongs inside that guard is for whoever picks this up. Outside it,
it clears a selection the user cannot have made, since the page is inert while the
dialog is open.

To replace the verse on purpose, a stand-in page can swap the column's subtree while the
popover is open (`03-task-workflow.md`, "A local stand-in page runs the real files").
