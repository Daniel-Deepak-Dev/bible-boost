# B-006 — Alt+P / Alt+A / Alt+S do nothing in a real Chrome

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Blocked |
| Type | Pre-existing, cause not identified |
| Found by | [T-001](../EPIC-00-foundations/T-001-extract-bible-dom.md) acceptance run, 2026-11-08 |
| Blocks release | No |
| Size | S |
| Risk | Low to medium — adds the extension's first background script |

## The observation

On `/bible/339/EXO.13.TAOVBSI?parallel=114`, in the user's Chrome on Windows,
with the unpacked extension and the tab both reloaded:

- `Alt+P`, `Alt+A` and `Alt+S` did **nothing**, even after clicking the chapter
  text first and pressing the **left** Alt.
- The dock's **Parallel** and **Align verses** switches **worked**.
- Alignment, separators, the "Aa" re-align, chapter navigation and the
  single-version dock all worked.

## What was ruled out

| Suspect | Finding |
|---|---|
| T-001 broke it | **No.** The keydown handler is not in T-001's diff. The dock calls the same `setParallel()` / `save()` / `parseUrl()` and works. Another check found the handler responds to synthetic Alt+P/A in both the pre-T-001 and post-T-001 builds. |
| bible.com swallows the keys | **No**, at least in the Claude desktop app's built-in browser. Real Alt+P/A/S presses reached `window` capture, `document` bubble and `window` bubble listeners, all with `defaultPrevented: false` and `ctrlKey: false`. Recorded in `understandings/bible-com/05-theme-and-page-chrome.md`, Keyboard. |
| Keyboard or Chrome eats Alt+letter everywhere | **Probably not.** The user's keys work on `keyboardtester.com`. |
| — | A console `keydown` listener in the user's Chrome logged nothing, but it also logged nothing for a plain `P`, so it was never running. **That test proves nothing.** |

**Not established:** why the key presses do not reach `content.js`'s listener on
bible.com in that Chrome. The user chose to stop investigating and change how
the shortcuts are delivered instead.

## Decision

Move the three shortcuts to **`chrome.commands`**, Chrome's own shortcut system.

- Chrome catches a bound command key itself, before the page, so nothing on
  bible.com can swallow it.
- The user can see and change the keys at `chrome://extensions/shortcuts` with
  no code change. Chrome also shows there when a key is held by something else.
- The suggested keys stay `Alt+P` / `Alt+A` / `Alt+S`, so the docs, the dock
  tooltips and the extension's keyboard identity are unchanged.

## Requirements

**R1.** Declare `toggle-parallel`, `toggle-align` and `toggle-separators` under
`commands` in the manifest, with suggested keys `Alt+P`, `Alt+A`, `Alt+S`.

**R2.** Add `background.js`, registered as a module service worker in the form
T-002 R1 specifies. For now it does one thing:
`chrome.commands.onCommand` → `chrome.tabs.sendMessage(tab.id, {type:'command', command})`.
It reads `runtime.lastError` so a non-bible.com tab, where nothing is listening,
fails quietly. It holds no state (T-002 R8).

**R3.** In `content.js`, the three actions live in **one** `COMMANDS` table,
which both the `command` message and the existing keydown listener use. The
conditions (Align only in parallel, Separators only in parallel with Align on)
are written once.

**R4.** Keep the in-page keydown listener as a fallback, for when Chrome could
not assign a suggested key. T-015 and T-024 extend that listener.

**R5.** No new permission. `chrome.commands` and `chrome.tabs.sendMessage` to a
tab id need none.

## Files

- `manifest.json` — `background` and `commands`
- `background.js` — new
- `content.js` — `COMMANDS` table, keydown through it, `command` message
- `README.md` — say where the shortcuts can be changed
- `work/requirements/EPIC-00-foundations/T-002-service-worker.md` — the worker now exists
- `work/requirements/EPIC-03-full-page/T-029-entry-points.md` — three of four suggested-key slots now used
- `work/understandings/extension/03-messaging.md`, `05-mv3-constraints.md`

## Acceptance

- [ ] `chrome://extensions` shows BibleBoost with a service worker and no errors
- [ ] `chrome://extensions/shortcuts` lists the three BibleBoost shortcuts with
      `Alt+P` / `Alt+A` / `Alt+S`, or shows them unassigned if Chrome refused a key
- [ ] On the EXO 13 parallel page, `Alt+P` leaves parallel mode, and pressing it
      again re-enters it
- [ ] `Alt+A` turns alignment off and on, **once per press**, not twice. A
      double toggle would mean both the command and the keydown fallback fired.
- [ ] `Alt+S` turns separators off and on, once per press
- [ ] A shortcut rebound at `chrome://extensions/shortcuts` works with the new key
- [ ] On a non-bible.com tab, pressing the shortcuts logs nothing in the service
      worker's console
- [ ] The popup's `state` / `setParallel` / `go` messages are unaffected

**If the shortcuts still do nothing after this:** leave this bug **open**, record
what `chrome://extensions/shortcuts` shows for BibleBoost, and record whether
the service worker's console logs anything on a key press.

## Where it stands (2026-11-08)

**Blocked on:** diagnostics from the machine where it fails. The checks are
listed below.

**The `chrome.commands` change did not fix it.** After reloading the extension
and the tab, the user reported that `Alt+P` / `Alt+A` / `Alt+S` still do
nothing. The user then chose to stop investigating and leave this open.
**Not recorded:** what `chrome://extensions/shortcuts` showed for BibleBoost,
and whether the service worker logged anything.

The change is kept anyway. It is harmless, it lets the user pick other keys,
and T-029 needs the `commands` block regardless. If it is ever reverted, put
T-002's and T-029's notes back as well.

That the command route failed too is itself a clue. The page listener and
Chrome's own shortcut handling are separate paths, and **neither** responded.
That points to one of two things:

1. **The keys were never assigned.** Chrome may not apply a new
   `suggested_key` when an already-installed unpacked extension is reloaded, and
   it leaves a key blank if something else holds it.
2. **The key press never reaches Chrome at all.** Something system-wide could
   take `Alt+P/A/S` first: a Tamil input tool, a hotkey utility, or a
   graphics-driver overlay. AltGr is the other possibility, if that Alt key is
   actually reported as Ctrl+Alt.

### Next session: do these in order, and stop at the first answer

1. **`chrome://extensions/shortcuts`**: are the three BibleBoost entries set to
   `Alt+P` / `Alt+A` / `Alt+S`? If they are blank, bind them there, or remove
   the extension and *Load unpacked* again, then retest. That would settle
   possibility 1.
2. **Bind one to a key no one uses**, such as `Ctrl+Shift+1` for Toggle
   alignment, at the same page. If that works, the Alt keys are being taken
   before Chrome, which is possibility 2. BibleBoost then only needs different
   default keys.
3. **Service worker console**: `chrome://extensions` → BibleBoost → the
   "service worker" link. Run
   `chrome.commands.onCommand.addListener((c) => console.log('cmd', c))`, then
   press the key on the bible.com tab. Chrome blocks pasting into a console until
   you type `allow pasting`. Check that the listener is live first, by pressing
   a binding you know works, because that is exactly how the 2026-11-08
   console test misled us.
4. **Ask what runs in the system tray.** Look especially for Tamil input tools
   and anything with global hotkeys.

## Notes

**A clue from T-015 (2026-11-10).** `Alt+N` was reported working in the user's real Chrome,
through the same `keydown` listener in `content.js`, and it has no `chrome.commands` binding.
So that listener does receive an Alt+letter press there, which counts against the page
listener being broken, and against AltGr or Alt being taken across the board. What is left is
something particular to P, A and S. One untested idea is that a key Chrome has bound never
reaches the page, so the fallback cannot fire for it, and the command is then lost on its way
to the tab. Whether `Alt+P/A/S` are still dead was not rechecked on that date.

**Known limitation: the dock tooltips name the default keys** ("Toggle parallel
mode (Alt+P)"). Content scripts cannot call `chrome.commands.getAll()`, so a
rebound key is not reflected there. Fixing that needs a message round trip to
the worker. It is not worth doing unless someone actually rebinds the keys.
