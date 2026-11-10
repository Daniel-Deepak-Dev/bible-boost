# bible.com — the verse action menu

> **Confidence: VERIFIED on 2026-11-10** against live bible.com, logged out. The
> selection behaviour and header were measured during T-008 on Exodus 13 (TAOVBSI
> and NKJV, both orders) and Romans 1 (CEV), and the header link again under `/de/`
> and `/ta/` interfaces during T-012. The action list was measured during T-013 on
> Exodus 13 at 1024px and 375px wide, and under an `/ar/` interface. Not measured: a
> signed-in session's rows, although the save row was reported landing correctly
> there by hand during T-013, and what applying a highlight does to the verse's
> classes or to the list.

## What selecting a verse does

Tapping a verse **in the primary column** adds a class to every element of that
verse, fragments included, and raises the menu:

```
<span class="cat7xG_verse cat7xG_verse-selected" data-usfm="EXO.13.2">
```

- **Only the primary (left) column responds to taps.** This follows position, not
  language: with TAOVBSI primary the English side is inert, and with NKJV primary
  the Tamil side is inert. The parallel column's verses still show
  `cursor: pointer`, which is misleading. A text drag does work there.
- Tapping another verse **adds** to the selection. Tapping a selected verse removes
  it. The Close button clears the whole selection.
- Selection order does not matter to the DOM. Tapping 2 then 1 reads as 1, 2.
- bible.com may scroll to keep the tapped verse clear of the menu: tapping Exodus
  13:4 moved the page by 200px. Test scripts must re-measure before each tap.
- Client-side navigation clears the selection and closes the menu.
- A drag across several verses selects text and adds no class. A short drag inside
  **one** verse does both: the verse gets the class and a text range exists too,
  which is why `capture.js` tries the class before the text.
- Hover changes no class on a verse.

## Every tap rewrites every verse's class

On each selection change, the class attribute of every verse in **both** columns
is rewritten, almost always to the value it already had. Measured on Exodus 13 in
parallel: 65 records for one tap, 63 of them no-ops. `oldValue` equals the new
value, so anything reading these records must compare before believing them.

## The menu's structure

It lives inside the reader, **not portalled to `body`**:

```
main#main
  ... div.cat7xG_yv-bible-text [data-testid="chapter-content"]
    div.cat7xG_bible-reader
      div.cat7xG_reader              (the columns are in here)
      div.fixed.pointer-events-none  (menu root, positioned at the bottom)
        div.pointer-events-auto.translate-y-0   (the card)
          header row
            p                        "Currently Selected:"
            a[href] > p, svg         the p holds the reference, then the version abbreviation
            button[aria-label="Cancel"]
          div.flex-col.divide-y-small   (the action list)
            div                      Highlight, then the colour swatches
            div                      Copy
            div                      Compare
            div                      Share
          div                        the sign-up prompt (logged out only)
```

Those utility class names are plain Tailwind rather than hashed, but they are
styling and can change with any build. Treat them as a description, not as
selectors.

- **Rows are `div`s** with an icon `div` and a `p` label. The label is a **text
  node**, in the interface language, with no `aria-label`. Only the close button
  is a real `button`.
- **The menu is always mounted.** It exists before the first tap and stays after
  closing, moved off-screen by a `translate-y-[calc(100%+24px+var(--audio-bar-h))]`
  class on the card, which becomes `translate-y-0` when open. So "is the menu in
  the DOM" says nothing about whether a verse is selected.
- **While closed, the menu root is `inert` and `aria-hidden="true"`.** Both clear
  when it opens. So a real `button` inside cannot take focus while the card is
  off-screen, and an off-screen menu needs no tabindex handling.
- The same element is reused across selections. The five colour swatches inside
  it are removed and re-added on every selection, so that part is a `childList`
  mutation each time. Nothing else changes: a recording observer saw no record for
  the list's own children across selecting, adding a verse, closing and reopening.
- **Client-side chapter navigation replaces the whole menu**, root included.
  Measured with the next-chapter arrow from Exodus 13 to 14: the old root and list
  were disconnected, and a node added to the list was gone. Reuse holds within one
  chapter only.

## The action list, measured

Measured during T-013 on Exodus 13, with a test button placed in the list.

**How to find it.** Start at the header link and climb, stopping before any ancestor
that contains a reader column. Take the first sibling with at least three children
that each hold both an `svg` and a `p`. At 1024px, at 375px and under `/ar/`, that was
the right element, and at 1024px it was the only element in `main` with such children.
This is `findList` in `src/content/menu.js`, the one place to repair if it breaks.

| Part | Measured |
|---|---|
| Row | a `div`, flex, `justify-content: space-between`, 14px padding, 52.67px tall at both widths. Highlight is 60.7px because of its 32px swatches |
| What is clickable | The left group only, icon plus label: that `div` has the `onClick`. The row, the list, the card and every ancestor carry no React event handler |
| Icon | 24px `svg`, `aria-hidden`, drawn in `currentColor`, 8px before the label |
| Label | `p`, weight 700, line-height 1.25, 13px below 640px and 16px from 640px. Their `md` breakpoint is `min-width: 640px`, not 768px |
| Colour | `#FFFFFF` on dark, `#121212` on light. The card's inherited colour is a dimmer `#E0E0E0` on dark, so a row that inherits looks wrong |
| Hover | The cursor changes and nothing else. No background |
| Divider | `:where(.divide-y-small > :not(:last-child))`, a 0.67px bottom border |

**The divider is a trap.** `:where()` has no specificity, so any direct child of the
list picks up the divider for free, and any `border` declaration on that child,
even a reset, removes it.

**A node added to the list is left alone.** It survives selecting, adding a verse,
closing and reopening. A real click on it neither clears the selection nor closes
the menu, with no `stopPropagation`. On a `button`, Enter and Space each produced one
click with no scroll and no change to the selection.

**Tab order.** From the close button, the first Tab lands on the swatch strip, because
it is a scroll container and Chrome makes those keyboard-focusable. The row after
Highlight is the second Tab. Space while on the strip scrolls the page, so a test that
presses one Tab and then Space appears to show a broken row.

**Right-to-left.** Under `/ar/` the `<html>` is `dir="rtl" lang="ar"`, but the menu sits
inside the primary version's reader wrapper (`lang="ta"` for TAOVBSI) and computes
`direction: ltr`. bible.com flips each row with `flex-direction: row-reverse` instead,
so `html[dir]` does not say how a row is laid out. Read it from a neighbouring row.
Only an RTL interface with an LTR version was measured.

## A modal `<dialog>` over the page

Measured during T-014 on Exodus 13, logged out, with the save popover open through
`showModal()`, and real clicks and key presses.

- **The selection and the menu are left alone.** The verse keeps its class and the
  header keeps naming it, through opening, Escape, Cancel and saving.
- **A real click on a verse through the backdrop changes nothing.** The page is inert
  and the selection stayed as it was.
- **`preventDefault` on Escape's `keydown` stops the browser's own close.** No `cancel`
  event followed it.
- **The dialog's `close` event is late.** It arrived 320 ms after `close()`, with the
  Browser pane in the background. Anything that has to be finished before the next
  open must not wait for it.
- **bible.com can navigate underneath it.** Narrowing the window to 375px dropped
  `?parallel=114` by client-side navigation while the dialog was open, and replaced the
  menu. The dialog stayed, with the typed text in it, and its trigger was disconnected.
- **Two buttons can read "Cancel".** The menu's close button has that `aria-label`, so
  a search by name finds it as well as the popover's own.

## The header link is the best thing on the page

| State | `href` | Visible text |
|---|---|---|
| One verse | `/bible/339/EXO.13.2.TAOVBSI` | `யாத்திராகமம் 13:2 TAOVBSI` |
| Contiguous | `/bible/339/EXO.13.1-2.TAOVBSI` | `யாத்திராகமம் 13:1-2 TAOVBSI` |
| With a gap | `/bible/339/EXO.13.1-2,4.TAOVBSI` | `யாத்திராகமம் 13:1-2,4 TAOVBSI` |
| Combined verse | `/bible/392/ROM.1.3-4.CEV` | `Romans 1:3-4 CEV` |
| Nothing selected | `/bible/339/EXO.13.TAOVBSI` | `யாத்திராகமம் 13: TAOVBSI` |

The `href` is canonical and unlocalized, carries the version id, and loses its
verses when nothing is selected. Read it rather than the text.

The one thing the text is for is a caption (T-012). The book name in it is the
version's, not the interface's: under `/de/`, NKJV still reads `Exodus 13:2 NKJV`.
It names the **primary** version only and speaks for the whole selection, so it is the
reference of one verse only when the `href` names exactly that verse. `13:2-3` is the
reference of neither verse. The abbreviation on the end matched `parseUrl(a.href).abbr`
on every page measured, so strip that rather than guess from the text's shape.

Three traps when finding it:

1. **Search inside `main`, not the document.** The sidebar's Recents list can hold
   a verse-level link once a page such as `/bible/339/EXO.13.2.TAOVBSI` has been
   visited. It sits outside `main`. On the matching chapter, a document-wide search
   would report that verse as selected when nothing is.
2. **A verse-level URL is a different page.** `/bible/339/EXO.13.2.TAOVBSI` renders
   a single-verse page with no columns and no verse elements at all, and shows a
   verse-level link of its own.
3. **A combined verse reads as a range.** The header says `3-4` where the verse
   element is `ROM.1.3+ROM.1.4`. Look the verses up in the column of the version
   the `href` names. On `/bible/392/ROM.1.CEV?parallel=114` the CEV column has keys
   3 and 5 while NKJV beside it has 3, 4 and 5, so reading every column would
   report a verse 4 that was never selected.

The inspection recipe that produced all this: snapshot `className` for every
`[data-usfm]` element, tap a verse, compare, and attach a recording
`MutationObserver` with `attributeOldValue: true`.

## Integration strategy (see T-013, T-015)

1. **Selection is detected at runtime** by `src/content/capture.js`. The class name
   above is what the code learns, not what it contains.
2. **Anchor positionally, not by the word "Copy".** The interface language can be
   anything. Insert relative to the action list's children, and **append at the end
   if the anchor is not found** — never fail to insert.
3. **Inject idempotently.** The menu is reused, so a row can already be there. The
   swatch redraw shows that parts of it are rebuilt, so check every time.
4. **Mark every injected node `data-bb-own`** so the observer guard
   (`extension/04-observer-hazards.md`) can ignore it.
5. **Always ship the independent fallback** — the extension's own save chip plus
   a keyboard shortcut (T-015) — so the feature degrades instead of dying.

## Do not fight the page

The project's founding rule, stated in `content.js` and the README: BibleBoost
**keeps bible.com's own verse DOM** so that tap-to-highlight, Copy, Compare and
Share keep working. Adding a row to the menu is additive. Never remove,
re-order or re-render bible.com's own rows.
