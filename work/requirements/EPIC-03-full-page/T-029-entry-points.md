# T-029 — Entry points and Alt+Shift+N

| Field | Value |
|---|---|
| Epic | EPIC-03 Full-page app |
| Status | Not started |
| Depends on | T-025 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

A page nobody can find is not a feature. The notes page needs to be reachable
from wherever the user happens to be — including pages that are not bible.com,
which is the case the content script cannot serve.

## Scope

**In:** the ways to open the page, and reusing an existing tab.

**Out:** the page itself (T-025).

## Requirements

**R1.** Four entry points:

| From | Behaviour |
|---|---|
| The toolbar popup | a "Notes" button, prominent, on every page |
| The side panel header | "open in full page", carrying the current note or filter in the hash |
| `Alt+Shift+N` | anywhere, via `chrome.commands` |
| Right-click on a verse | optional context-menu item, only if the `contextMenus` permission is judged worth it |

**R2.** `Alt+Shift+N` uses **`chrome.commands`**, not the content script's
keydown handler, because it must work on any page. This is the opposite choice
from `Alt+B` and `Alt+N`, which are bible.com-only and therefore live in
`content.js`. **Comment the distinction** — it will look inconsistent otherwise.

```jsonc
"commands": {
  "open-notes": {
    "suggested_key": { "default": "Alt+Shift+N" },
    "description": "Open BibleBoost Notes"
  }
}
```

> **Since B-006:** `Alt+P/A/S` are also `chrome.commands`, so the manifest
> already has a `commands` block. Add `open-notes` to it. That is the **fourth
> and last** suggested key Chrome allows. B-006 also changed the reasoning above:
> a bible.com-only shortcut can still go through `chrome.commands` when the page
> listener proves unreliable. Comment both reasons.

**R3. Reuse an existing tab.** Query for an open notes tab first; focus it and
update its hash rather than opening a second one. A user who hits the shortcut
five times should have one tab, not five.

**R4.** Opening from the panel carries context in the hash — the open note, or
the current topic and filter — so the transition feels continuous rather than
like starting over.

**R5.** The popup's Notes button shows the total note count, so the popup is also
a small status surface.

**R6.** The popup button works on **any** page, not just bible.com. The popup
currently greys out its parallel row when the content script does not reply; the
Notes button must not be gated by that check.

**R7.** `chrome.commands` shortcuts can collide with other extensions and Chrome
silently drops the loser. Tell the user where to check — `chrome://extensions/shortcuts`
— in the README and in the popup if the command is not registered.

## Files

- `popup.html`, `popup.js` — the Notes button and count
- `background.js` — `chrome.commands.onCommand`, tab reuse
- `src/ui/panel.js` — the expand affordance
- `manifest.json` — `commands`
- `README.md`

## Reference

- `work/understandings/extension/03-messaging.md` — the popup's existing
  content-script channel, and why `state` doubles as a bible.com check
- `work/understandings/extension/05-mv3-constraints.md` — worker lifetime; the
  command handler must work from a cold start

## Acceptance

- [ ] The popup's Notes button opens the page from bible.com **and** from any
      other site
- [ ] It shows the note count
- [ ] `Alt+Shift+N` opens the page from an unrelated website
- [ ] Pressing it three times focuses one tab rather than opening three
- [ ] "Open in full page" from the panel opens on the same note
- [ ] The command still works after the worker has been idle and terminated
- [ ] The popup's existing parallel row and version pickers are unaffected
- [ ] If the shortcut is unregistered, the UI points at
      `chrome://extensions/shortcuts`

## Notes

R3 is the difference between a tool that feels tidy and one that litters tabs.
It is a few lines and it is the thing users notice.
