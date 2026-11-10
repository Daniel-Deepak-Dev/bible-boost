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
