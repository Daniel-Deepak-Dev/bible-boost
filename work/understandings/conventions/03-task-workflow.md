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
- **Test with the reader's settings changed, not only the defaults.** T-058's creep did not
  exist on a default profile and appeared at once with Footnotes off.
- **A hidden browser pane can refuse real input.** A key press timed out once with the
  pane hidden and worked when retried. Found during T-057.
- **A hidden browser pane never fires `requestAnimationFrame`**, even with
  `document.visibilityState` reading `visible`. `schedule()` ends in one, so a pass that
  depends on it silently never happens, and that looks like a bug in the code under
  test. Replace it with a `setTimeout` on the test page. Found during T-058.
- **The built-in browser's `javascript_tool` is not held to the CSP.** T-014 set
  `window.BB = {}` and pasted each file's IIFE straight in, without its `var BB` line
  and with no `<script>` element.
- **The worker can be stood in for.** `Object.defineProperty(window, 'chrome', ...)`
  with a `runtime.sendMessage` that answers like the router lets page code run a whole
  save. It proves nothing about what the real worker stores.
- **A screenshot can show only part of an emulated viewport.** At 1024x800 and 760x600
  the image held the top-left of the page. Read positions with
  `getBoundingClientRect` rather than from the picture, and move an element into view
  to look at it.
- **The save toast is gone in five seconds**, which is less than one round trip of
  separate tool calls. Press Undo in the same call as the save.

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
