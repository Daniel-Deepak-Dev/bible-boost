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
   the part before the plus sign.
2. **A verse can be split across paragraphs.** Several elements share one
   `data-usfm`. `firstSpans()` keeps only the **first** occurrence, in document
   order, in a Map. Insertion order equals document order, which downstream code
   relies on.

Never key on the bare verse number: two chapters can render on one page and would
collide.

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

## Selection state — UNVERIFIED

The class bible.com adds to a selected verse is **hashed and unknown**. Do not
hardcode one. See `06-verse-action-menu.md` for the runtime-discovery strategy.
