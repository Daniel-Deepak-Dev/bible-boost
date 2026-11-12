# Task workflow

How to pick up and finish a task in `work/requirements/`.

## Picking up a task

1. Open `work/requirements/README.md` and pick the next task whose
   **Depends on** entries are all Done.
2. Read the task file **in full** — including its **Reference** section, which
   links to the `work/understandings/` files you must read first.
3. **Read those understanding files.** They exist specifically so you do not have
   to guess about bible.com's DOM. Guessing is how this project gets bugs.
4. Set the task's `Status` to `In progress`.

## While working

- Follow `01-code-style.md` and `02-css-and-theming.md`. A reviewer should not be
  able to tell which files are new.
- Stay inside the task's **Scope / Out** list. If you find other work, write a
  new task file rather than widening this one.
- If something in an understanding file turns out to be **wrong**, fix that file
  in the same change. A stale understanding is worse than none.

## Finishing

1. Work through the task's **Acceptance** checklist and tick each box. Do not
   tick a box you did not actually verify.
2. If the task touched bible.com's DOM, run the **no-regression check**: open a
   parallel chapter, confirm verses still align and separators still draw,
   confirm `Alt+P` / `Alt+A` / `Alt+S` still work.
3. Set `Status` to `Done`.
4. **Record what you learned.** If you discovered anything about bible.com, about
   Chrome, or about a trap a future session would fall into, add it to the right
   file under `work/understandings/` — or create a new one. This is not optional
   bookkeeping; it is the main defence against repeated bugs.
5. **Write the hand-test guide** if anything changed that the user can see or
   click. See below.

## The hand-test guide

Most Acceptance boxes here need a person, the unpacked extension and a live page.
A checklist says *what* must be true, and leaves the user to work out how to get
there. The guide closes that gap. The user asked for it on 2026-11-10, for every
task with something to test in the UI.

**When.** Whenever a session's work changes something visible or clickable, whether
or not the task is Done. Pure logic that `node --test` covers, and docs-only work,
get no guide; say so in one line instead.

**Where.** In the task file, as `## Test it by hand` after **Acceptance**, and in
full in the closing message so the user need not open the file. A later session
that changes the work **rewrites** the section rather than appending to it.

**Shape.** Numbered steps, in this order:

1. **Load the change.** Always first: `chrome://extensions` → BibleBoost → the
   reload arrow, then reload every bible.com tab that was open. A content script
   does not update in a tab that was already open. For the popup, close it and
   open it again.
2. **Reach the starting state.** The exact URL, the window width, the theme, and
   signed in or out. Say how to get each one:
   - Theme: bible.com's account menu, the round button at the top right, then
     **Appearance → Light** or **Dark** (verified 2026-11-10).
   - A tablet width: DevTools' device toolbar, `Ctrl+Shift+M`, **Responsive** at
     820 × 1180, an iPad Air held upright.
   - A large screen: a maximised window on the biggest monitor at hand, or
     **Responsive** at 1920 × 1080.
   - Never a phone width. See AGENTS.md, Target screens.
   - The standing page is `/bible/339/EXO.13.TAOVBSI?parallel=114`.
3. **One action per step, then what to expect.** Name a control by what is on the
   screen: its visible label, its icon or its place ("the slim **B** tab on the
   right edge"). Name keys exactly. Describe the result as something seen ("the
   bottom-left corner is rounded and the right side is square"), never as a
   property value.
4. **Tie each step to an Acceptance box**, ending it with
   `→ Acceptance: <the box's words>`. The user can then answer "step 6 failed",
   and the next session knows which box stays empty.
5. **Finish with the standing regression** if page DOM was touched.
6. **Say what to send back on a failure**: a screenshot, the Console output from
   the **BibleBoost** context, or the step number and what was seen instead.

**Rules.**

- **Check every step against the code or a live page before writing it.** A
  button's label, a key, a URL. A guide with one wrong name costs the user more
  than no guide, because they stop trusting the rest.
- **Cover every unticked box that a person can see.** A box the session already
  verified some other way can be left out of the guide, as long as the task's
  Notes say how it was checked.
- **When the user reports back, tick exactly the boxes their steps cover**, and
  write "Checked by hand by the user, <date>" in Notes. A step they skipped
  ticks nothing.
- **A console snippet must not declare a name the window already owns.** `top`,
  `parent`, `self`, `name`, `status`, `length`, `origin`, `frames`, `opener` and the
  like are properties of `window`. At the console's top level, `const top = …` fails
  with "Identifier 'top' has already been declared" and none of the line runs. The
  same line works when a test tool wraps it in a function, so the snippet passed
  every check before the user ran it. T-021's step 7 did exactly this. Use plain
  names such as `first` or `row`.

## Checking page code from a console

Each of these cost a round of confusion during T-012.

- **`BB` exists only in the extension's isolated world.** In DevTools, choose
  **BibleBoost** in the Console's context dropdown. Chrome puts it back on `top`
  whenever the page reloads, and the symptom is `BB is not defined`.
- **Tapping a selected verse deselects it.** A check that taps has to start with
  nothing selected, or it ends with no selection and looks like a bug.
  `BB.capture.getSelection()` also returns `null` if it throws, and only the Verbose
  log level shows `capture: getSelection failed`.
- **A browser that cannot load the extension can have the code pasted in.** bible.com's
  CSP refuses `eval` but allows inline scripts, so a `<script>` element whose
  `textContent` is the code runs. Holding the source in `sessionStorage` reuses it
  across full page loads. Remove it afterwards.
- **A browser pane with no width changes the page.** At an `innerWidth` of 0,
  bible.com dropped `?parallel=` and rendered one column, so set a viewport first.
- **The CSP limits how pasted code can arrive.** `connect-src` and `script-src` do
  not list localhost, so the code cannot be fetched or loaded from a local server and
  has to be pasted. `style-src` refuses a `<style>` element, but a `CSSStyleSheet`
  with `replaceSync` added to `document.adoptedStyleSheets` applies. Found during T-013.
- **Test the light theme by emulating `prefers-color-scheme`.** With no stored
  choice, a logged-out bible.com follows it and sets `html.light` itself. Swapping the
  class by hand changes the text but leaves the menu's card dark.
- **`verseEl.click()` selects a verse**, which makes a long tap sequence scriptable.
- **A local stand-in page runs the real files.** A throwaway Node server in the
  scratchpad can serve the content scripts and `content.css`, with HTML shaped like the
  reader at any `/bible/...` path and a stubbed `chrome` ahead of the scripts. `parseUrl`
  does not look at the host, and `DEBUG_SCHEDULE` can be switched on as the file is
  served. It proves the extension's own logic and nothing about bible.com, so it ticks
  no box that names a live page. Found during T-057.
- **A local proxy runs the real files on the real page.** A throwaway Node server in the
  scratchpad can fetch bible.com's pages, drop the CSP header, turn absolute `/_next` URLs
  relative, and add the content scripts at `DOMContentLoaded`. The real page hydrates, and
  bugs a stand-in cannot show appear, as T-058's creep did. Cache every response. Reader
  settings are cookies on localhost, so set them through the page's own Settings panel. A
  timeline of the verse's top sampled every 25 ms from the page's start is what found the
  cause. Found during T-058.
- **The proxy can run the real worker as well.** Stub only `chrome.*`, in a script injected
  at the top of `<head>`. At `DOMContentLoaded`, `import` `background.js` first, then add the
  content scripts, and route `sendMessage` to the listener the worker registered, because
  `content.js` registers one too. A save then goes through the real router and `repo.js` into
  real IndexedDB at the localhost origin. Delete that database afterwards, from a page that has
  no connection open. Found during T-016.
- **The reader's settings stay on localhost between sessions.** `footnotes=false` from T-058
  was still there, so read `document.cookie` before calling a run the default. Found during
  T-016.
- **The built-in browser refuses a service worker.** `navigator.serviceWorker.register` failed
  with "An unknown error" on a script that `fetch` and a module `Worker` both loaded. A `Worker`
  shows a module loads with no `window` or DOM, and nothing about a real worker's events. Found
  during T-016.
- **A cross-origin frame can be tested through the proxy.** Serve it from a second localhost
  port, point the stubbed `chrome.runtime.getURL` there, and append a small `message` handler
  to the copy being served, so the page can ask the frame what it knows. A `data:` frame and a
  `srcdoc` frame make two different kinds of stranger. It proves nothing about
  `chrome-extension:` origins or the isolated world. Found during T-017.
- **Serve the old code beside the new, and run the same check on both.** A stand-in that
  only shows the fix passing shows nothing if the check could never fail. For B-012 the
  server swapped the one changed line back as it served the file, behind `?old=1`, and
  the old column failed where the new one passed. A private flag such as `frameReady`
  can be read by appending one line inside the file's closure as it is served.
- **A frame the page cannot reach can press its own button.** The page cannot click
  inside a cross-origin frame, but the copy of `panel.js` being served can be given a
  line that clicks `#bb-close` when asked, or by itself when its URL says so. That goes
  through the real handler. Holding back the frame's HTML for a few seconds on the
  server is what makes room to act while it is still loading. Found during B-012.
- **Through the proxy, a chapter link is a full page load.** The `_rsc` request answers 200
  with a real payload and the whole document is reloaded anyway, so the proxy cannot show what
  client-side navigation does. Why was not worked out. Found during T-015.
- **A hidden browser pane delivers `scroll` events late**, 390 ms and 970 ms after `scrollTo`
  when measured. A check that reads 300 ms later sees UI that follows scrolling as stuck. Found
  during T-015.
- **Focusing bible.com's search box opens a dropdown over the reader.** Neither blur nor Escape
  closed it, so reload before carrying on. Found during T-015.
- **The panel's frame is its own Console context.** On `top`, or in the content script's
  **BibleBoost** entry, `document` is bible.com's, so asking it about the panel gives
  `undefined`, which looks like a broken channel. Right-click inside the panel and choose
  Inspect: that selects the frame, and `<html data-bb-open="true">` is right there. Seen
  during T-017.
- **Real Chrome can load the extension on a throwaway profile.** A Node script in the
  scratchpad starts it with `--headless=new --remote-debugging-pipe
  --enable-unsafe-extension-debugging --user-data-dir=<temp>`, speaks the debugging protocol
  over file descriptors 3 and 4, and calls `Extensions.loadUnpacked`. `Target.setAutoAttach`
  with `flatten` then gives a session inside the panel's out-of-process frame, where
  `chrome.storage` works too. Unlike the proxy this proves real origins, the real isolated
  world, the real CSP and real storage. Worked on Chrome 157. Branded Chrome is said to have
  dropped `--load-extension` (from its release notes, not tried here). Found during T-017.

  **bible.com now challenges it.** Later the same day, during T-018, the same recipe got a
  page titled "Client Challenge" asking for the characters in an image, instead of the
  reader. **Do not try to get past it**, by changing the user agent or any other way:
  that is defeating a bot check, and auto mode refused it. Treat headless Chrome as closed
  for live bible.com, and leave those boxes for the user's own Chrome.
- **Send no made-up user agent from the proxy either.** T-018's proxy first sent a browser's
  `user-agent` string upstream, which is the same thing, and it was taken out. Whether
  bible.com answers Node's own user agent with the real page was not established after
  that.
- **Test with the reader's settings changed, not only the defaults.** T-058's creep did not
  exist on a default profile and appeared at once with Footnotes off.
- **A hidden browser pane can refuse real input.** A key press timed out once with the
  pane hidden and worked when retried. Found during T-057.
- **A hidden browser pane never fires `requestAnimationFrame`**, even with
  `document.visibilityState` reading `visible`. `schedule()` ends in one, so a pass that
  depends on it silently never happens, and that looks like a bug in the code under
  test. Replace it with a `setTimeout` on the test page. Found during T-058.

  **It skips the whole rendering step, not only that.** CSS transitions stay at
  `currentTime` 0, so a transitioned length reads as its starting value, and
  `ResizeObserver` callbacks never arrive, so nothing it should trigger happens. Taking a
  screenshot renders a frame, and a transition can finish under it, so a value read before
  the screenshot and one read after disagree. When the session is not open in a window,
  the pane cannot be shown. Switch transitions off on the test page, stand in for the
  observer with something that calls the same code (a `resize` event reaches
  `schedule()`), and say plainly what that leaves unchecked. Found during T-018.
- **The built-in browser's `javascript_tool` is not held to the CSP.** T-014 set
  `window.BB = {}` and pasted each file's IIFE straight in, without its `var BB` line
  and with no `<script>` element.
- **The worker can be stood in for.** `Object.defineProperty(window, 'chrome', ...)`
  with a `runtime.sendMessage` that answers like the router lets page code run a whole
  save. It proves nothing about what the real worker stores.
- **The save popover runs on a blank page.** `save-popover.js` reads only `BB.dom`
  (`VID_RE`, `columnEls`, `firstSpans`), `BB.capture` (`getSelection`, `versePair`,
  `displayRef`) and `chrome.runtime.sendMessage`. A localhost page that stands in for those
  three, set before the file loads, opens the real popover with `content.css`, and real key
  presses in the built-in browser drive it. A stand-in worker that answers `topics/list`
  seconds late, with the topics as they were when it was asked, is what showed B-017's
  late-list timing, which a live page almost never does. Found during B-013.
- **A screenshot can show only part of an emulated viewport.** At 1024x800 and 760x600
  the image held the top-left of the page. Read positions with
  `getBoundingClientRect` rather than from the picture, and move an element into view
  to look at it.
- **The save toast is gone in five seconds**, which is less than one round trip of
  separate tool calls. Press Undo in the same call as the save.
- **A hidden browser pane can return the same screenshot twice.** During B-019, moving every
  stand-in by tens of pixels left the next screenshot unchanged. `tabs_context` said the pane
  was hidden. Do not trust a picture taken while it is.
- **Hit-testing proves a rounded clip without a picture.** `document.elementFromPoint` respects
  `border-radius` with `overflow: hidden`, so a point 2px inside a rounded corner returns
  whatever is behind the box, and the same point with `overflow: visible` returns the child.
  B-019 used this to show `#bb-panel` clips its frame. A modal `<dialog>` makes the rest of the
  page inert, and every point then returns the dialog, so close it first.
- **`fetch` from bible.com to localhost fails**, as `connect-src` says it will. To run the
  real `content.css` on the live page, minify it and paste it into a `CSSStyleSheet` with
  `replaceSync`. Found during B-019.
- **The real panel and the real worker run together on one localhost port.** Serve
  `panel.html` with a `chrome` stub injected at the top of `<head>`, whose `sendMessage`
  routes to the listener `background.js` registers once the stub has `import()`ed it, and
  whose `storage` fires `onChanged` only for keys whose value changed, as Chrome does.
  `panel.js` is served with its `HOST_ORIGIN` swapped for the reader stand-in's origin, on a
  second port. Two localhost ports are one site, so the panel framed in the reader saw the
  same IndexedDB as the panel opened on its own, where the notes were seeded. Delete the
  database afterwards, from a page with no connection open. Found during T-021.
- **A probe in the stub reads the cross-origin frame.** The stub can answer a
  `postMessage({ probe: '<code>' })` by running the code in the frame and posting the result
  back, so the reader page can ask what the panel's `<html>` class is, or how many rows it
  holds. Stand-in only, never in shipped code. Found during T-020.
- **A made-up pointer cannot be captured.** `setPointerCapture` throws for the `pointerId`
  of a synthetic `PointerEvent`. To drive drag logic from script, replace it on that one
  element with a no-op for the test and put it back. That proves the logic and nothing about
  capture itself, which needs a real mouse. Found during T-019.
- **A hidden pane leaves a transition running even after its property is removed.**
  Removing the rule that added `transition: width 0.2s` leaves the default `all 0s`, which
  still matches, so the frozen transition is kept, and the element reads its start value
  indefinitely. `el.getAnimations().forEach((a) => a.finish())` before measuring. A real,
  visible page finishes in 0.2s and never meets this. Found during T-019.
- **A hidden pane throttles `setTimeout` too**, so a test of what a 150ms timer shows needs a
  delay far longer than that (2s worked) to mean anything. Found during T-021.
- **A hidden pane gives `focus()` no focus events.** `document.activeElement` changes,
  but `focus` and `focusin` never fire, so code that tracks focus only through `focusin`
  looks broken there. The note list's tab stop was, and now also moves in the code that
  calls `focus()`. A real window fires them, so the fix is for robustness, not for this
  pane. Found during T-021.
- **Drive a virtual list with its keys, not by scrolling, in a hidden pane.** Setting
  `scrollTop` redraws through `requestAnimationFrame`, which the hidden pane throttles,
  so the rows on screen stay stale and any comparison with the worker fails for no
  reason. Home, End and PageUp go through code that draws at once. Found during T-021.
- **Check which copy of a module ran.** Once, a page loaded straight after an edit ran the
  file from before it, served with `no-store`. `performance.getEntriesByType('resource')`
  gave the old `transferSize`, and a new query string on the page loaded the new file.
  Found during T-021.

## Status values

`Not started` · `In progress` · `Blocked` · `Done`

A `Blocked` task must say what it is blocked on, in its Notes section.

Write the value **and nothing else** in the Status cell. `work/status.sh` matches
the whole cell, so `Done — with a caveat` is counted as "not started" on the
board. Put the caveat in the task's body.

## Seeing the board

```bash
sh work/status.sh
```

Reads the `Status` line out of every task file. The files are the single source
of truth — `README.md` is an index, not a status board.

## Task id scheme

- `T-NNN` — task, globally sequential, so a task can move between epics without
  renumbering.
- `B-NNN` — bug or pre-existing debt.
- `EPIC-NN-<slug>/` — the folder. The epic's own `EPIC.md` holds the goal, the
  task list and the definition of done.

## Writing a new task

Copy the shape of an existing one. It must have: Why, Scope (In **and** Out),
numbered Requirements, Files, Reference links, and an Acceptance checklist whose
items are things you can actually observe. A requirement a future session has to
interpret is a requirement that will be implemented wrong.
