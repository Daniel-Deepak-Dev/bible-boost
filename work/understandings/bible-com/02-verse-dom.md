# bible.com — verse DOM

Confidence: **verified**. This is the most important file in this folder.

## The selector

```js
col.querySelectorAll('[class*="_verse"][data-usfm]')
```

Class names are **hashed CSS modules**. They change between builds. Always match
a *substring*, never an exact class, and prefer matching on `data-usfm` or on
structure.

## data-usfm is the canonical key

Value looks like `EXO.13.2` — BOOK.chapter.verse. Use it as the primary key for
anything stored. It is stable across versions **and across languages**, which is
what makes a Tamil note and an English note about the same verse linkable.

Two traps:

1. **Combined verses.** The attribute can read `JHN.1.1+JHN.1.2`. Always take
   the part before the plus sign. A live example to test against: CEV Romans 1,
   `/bible/392/ROM.1.CEV`, has `ROM.1.3+ROM.1.4` and `ROM.1.14+ROM.1.15`.
2. **A verse can be split across paragraphs.** Several elements share one
   `data-usfm`. `firstSpans()` keeps only the **first** occurrence, in document
   order, in a Map. Insertion order equals document order, which downstream code
   relies on.

Never key on the bare verse number: two chapters can render on one page and would
collide.

Two more, both measured on `/bible/339/EXO.13.TAOVBSI` during T-008:

3. **The chapter wrapper has `data-usfm` too.** `div.cat7xG_chapter` carries
   `EXO.13`, so a bare `[data-usfm]` query finds 44 elements where there are 43
   verse elements. Use `BB.dom.VERSE_SEL`.
4. **A fragment can be nothing but whitespace.** In TAOVBSI most verses are
   followed by a second `_verse` element containing only spaces, which gives 43
   elements for 22 verses. NKJV has 22 for 22. Anything counting or testing
   "covered text" has to expect these.

## Verse label vs footnote marker — read this before extracting text

```js
el.querySelector(':scope > [class*="_label"]')   // the verse NUMBER
```

- A verse's own number label is a **direct child**.
- A **footnote marker** is also a `_label` element but nested **deeper**.
- A verse element with **no direct label** is a *continuation fragment* — the
  tail of a verse that spilled into the next paragraph.
- The chapter wrapper has a direct `_label` of its own, holding the chapter number
  (`13`), set to `display:none`. It is not a verse number.

**A verse label is not always a bare number.** CEV's combined verse is labelled `3-4`
and `14-15`. NIV labels Matthew 17:21 `[21]`, a verse it keeps only in a footnote,
while its menu header writes `Matthew 17:21`. On the 9 pages measured for T-012,
across TAOVBSI, NKJV, NIV, CEV and DELUT, the first element of every verse had a
direct label.

## What a note is — removing the labels is not enough

The marker is only half of a note. Measured on live bible.com on 2026-11-09:

```html
<span class="cat7xG_verse" data-usfm="EXO.13.2">
  <span class="cat7xG_label">2</span>
  <span class="cat7xG_note cat7xG_x">
    <span class="cat7xG_label">#</span>
    <span class="cat7xG_body">Ex. 13:12, 13, 15; 22:29; …</span>
  </span>
  <span class="cat7xG_content">“Consecrate to Me all the firstborn, …</span>
</span>
```

- `_note _x` is a cross-reference. A bare `_note` is a footnote, whose `_body`
  holds further spans: hashed `_fr`, `_fq` and `_fqa`, and a plain, unhashed `ft`.
  NIV John 3 has the second kind, and CEV Romans 1 has both.
- `_label` and `_body` inside a note are both `display:none`, measured on the
  cross-reference in NKJV Exodus 13:2 and on all 9 footnotes in NIV John 3. The
  note's text never shows on the page, **but `textContent` reads it**, and
  `innerText` does not. So a bad extraction looks fine on screen and is only
  wrong in the data.
- Removing only `_label` left note text in 73 of 134 verses across six English
  chapters. Exodus 13:2 in NKJV came out as
  `Ex. 13:12, 13, 15; … Luke 2:23“Consecrate to Me…`.
- **Tamil hides this.** Exodus 13, Romans 1 and Psalms 3 and 23 in TAOVBSI have
  no notes at all, while NKJV has them on 20 of the 22 verses of Exodus 13.

To extract clean verse text: clone the node, remove every `_label` (the number),
every `_note` (the footnote, whole) **and** every `_hide` (either of those, switched
off), then read `textContent`. `BB.capture.verseText` does this, and says so in a
comment, because they are different things that happen to share a class fragment.

### The reader's own switches rename these classes

bible.com's Settings panel in the reader has two switches that change the verse
markup. Measured on 2026-11-10, logged out, on Exodus 13 (TAOVBSI and NKJV) and
Romans 1 (CEV and NIV):

| Switch turned off | What changes in the verse |
|---|---|
| **Footnotes** | A note's wrapper loses `_note`: `_note _x` becomes `_hide _x`, and a bare `_note` becomes a bare `_hide`. The `_label` and `_body` inside it stay |
| **Numbers and Titles** | The verse number's `_label` becomes a bare `_hide`, `display: none`, with the number still in it |

- **This is the setting and not the account.** A signed-in Chrome with Footnotes off
  showed `_hide _x`, and turning Footnotes off logged out produced the same.
- **Nothing that matches `_note` or `_label` alone can be trusted to find these.**
  With Footnotes off, a rule of `_label` and `_note` removed the `#` and kept the note
  body, on 20 of the 22 verses of NKJV Exodus 13. Numbers and Titles off leaves `3And
  Moses…` if `_hide` is not removed.
- **A `_hide` is a number or a note.** Those were the only two kinds found inside a
  verse. Tell them apart by whether it holds a `_body`.
- **`verseLabel` finds nothing with Numbers and Titles off**, which is B-011. That
  switch is a `numbersTitles=false` cookie. Several verses saved with it off get no
  `displayRef`, so the caption reads `EXO.13.3-4`, while a single verse still gets one
  from the menu header (measured 2026-11-10).
- T-009's checks all ran with both switches on, which is the default.
- **The server does not apply these.** Footnotes off is a `footnotes=false` cookie, and
  the HTML for NKJV Exodus 13 had 32 `_note _x` with or without it (2026-11-10). The
  page rewrites them to `_hide` during hydration, about 400 ms after `document_idle`,
  and **the layout shrinks then**: the text above verse 6 came out 19px shorter. Anything
  measured at load is stale once that happens, and scrollY did not compensate. T-058
  has to keep correcting because of it.

## Poetry and what else is inside a verse

- **Each line of a poem is its own verse element**, inside its own `_q1` or `_q2`
  block. Psalm 23:1 in NKJV has two, so anything reading a verse's text has to
  collect them all. A verse can also change block type part-way: in NKJV Psalm 3:2
  the last fragment, "Selah", sits in a `_p`.
- **"Selah" is a `_qs` span and counts as verse text.** It is printed in the
  verse and belongs to it.
- Inline styling wraps `_content` and is kept: `_it`, `_sc`, `_bd`, `_wj`.
- bible.com's own text has doubled spaces ("The Lord  is  my shepherd"), so
  collapse whitespace rather than trust it.

## Measuring a verse's top

`topOf()` uses the label's rect when there is one, because the label is a single
rect; without one it uses the verse's **first** line box, not its last:

```js
return (label ? rects[rects.length - 1] : rects[0]).top;
```

## What scrolls

The **document**. Measured 2026-11-10 on `/bible/339/PSA.119.TAOVBSI?parallel=114` at
1600 x 1000: `document.scrollingElement` is `<html>`, and `window.scrollTo(0, 3000)`
moved verse 140's top by exactly 3000px.

- **An ancestor of the column has `overflow-y: auto` and never scrolls.**
  `_yv-bible-text` measured 19018 for both `clientHeight` and `scrollHeight`. It is
  easy to mistake for the scroller.
- `scroll-behavior` is `auto` on `html` and `body`, and `overflow-anchor` and
  `history.scrollRestoration` are both `auto`.
- **Sticky chrome covers the top 129px** at that size: the 72px `header`, then the 57px
  row of version chips. A verse can have a top on screen and still be behind it.
- **A click on the page's own scrollbar reaches a `window` `mousedown` listener**, with
  `html` as the target and `clientX` inside the scrollbar (seen 2026-11-10).

## Selection state

Selecting a verse adds `cat7xG_verse-selected` to every element of that verse
(verified 2026-11-09). It is still a hashed build artefact, so do not hardcode it:
`src/content/capture.js` learns it at runtime. `06-verse-action-menu.md` has the
detail, including that only the primary column responds to a tap.
