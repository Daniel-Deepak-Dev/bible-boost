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

To extract clean verse text: clone the node, remove the direct-child label (the
number) **and** the deeper label nodes (footnote markers), then read
`textContent`. Removing every `_label` descendant happens to achieve both, but be
deliberate about it and say so in a comment, because the two cases are different
things that happen to share a class fragment.

## Measuring a verse's top

`topOf()` uses the label's rect when there is one, because the label is a single
rect; without one it uses the verse's **first** line box, not its last:

```js
return (label ? rects[rects.length - 1] : rects[0]).top;
```

## Selection state

Selecting a verse adds `cat7xG_verse-selected` to every element of that verse
(verified 2026-11-09). It is still a hashed build artefact, so do not hardcode it:
`src/content/capture.js` learns it at runtime. `06-verse-action-menu.md` has the
detail, including that only the primary column responds to a tap.
