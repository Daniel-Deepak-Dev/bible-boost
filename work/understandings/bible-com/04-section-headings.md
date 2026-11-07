# bible.com — section headings and the "band"

Confidence: **verified**, with measured examples. This logic was hard-won; do not
rewrite it casually.

## The problem

bible.com puts a section heading — and anything travelling with it — in its own
block *before* the paragraph it introduces. Those blocks together are the
**band**. For alignment and separators you need the band's **topmost** block, not
the heading element itself.

Things that travel with a heading:

| USFM marker | What it is |
|---|---|
| `\s` | section heading |
| `\d` | psalm title |
| `\sp` | speaker label |
| `\qa` | acrostic label |
| `\r` | parallel-passage reference |

## Why it is not matched by class name

The obvious approach — match `_s` plus a digit — **never fired once on a live
page**. bible.com's current build emits a plain `_s` with no digit. The heading
is also often **not** the immediate previous sibling.

A band block is therefore recognised **structurally**: it contains no verse of
its own.

```js
const BAND_STOP_RE = /(?:^|\s)[^\s]*_(?:label|cl)(?:__[^\s]*)?(?=\s|$)/;
el.closest('[class*="_p"], [class*="_q"], [class*="_li"]')
```

`bandTop()` walks backward through `previousElementSibling`, stopping at:

- a block containing a verse (reached the previous verse), or
- a block matching `BAND_STOP_RE` — the chapter number (`_label`) or chapter
  title (`_cl`), which belong to the chapter, not to any section inside it.

## Two measured counter-examples that break naive implementations

1. **NIV, Song of Songs 1** — the block opens with the *tail* of verse 1 on
   verse 2's line. So the band anchor is not "the literal first node in the
   block"; it is the first verse in the block that actually **starts**, i.e. the
   first one with a direct label of its own. Requiring the literal first node
   looks stricter but misses the "She" speaker label above it.

2. **NKJV, Psalm 3** — runs `\s` then `\d` then the verse, so the heading is two
   siblings up, not one.

## Blank blocks

A `\b` blank line is an **empty block**, and bible.com drops those between
ordinary verses all over the Psalms. A blank block stays *inside* the band but
must never *anchor* it — anchoring on one would turn a plain verse row into a
heading row and jump its separator above the blank line. Hence:

```js
if (p.textContent.trim()) top = p;   // step over empties, keep walking
```

## Purity

`bandTop()` is **pure DOM reading, no geometry**. That is deliberate — it is safe
to call before heights are set, which is why `align()` resolves every anchor up
front, outside the measuring loop that must not disturb layout.
