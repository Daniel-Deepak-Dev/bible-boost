# B-014 — A combined verse saves a parallel side narrower than its caption

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Found by the review of T-010 and T-016 |
| Blocks release | No |
| Depends on | T-010, T-016 |
| Size | M |
| Risk | Medium |

## The problem

CEV writes Romans 1:3-4 as one element, `data-usfm="ROM.1.3+ROM.1.4"`, which `usfmOf`
keys as `ROM.1.3` (`03-columns-and-versions.md`). T-010 handles one half of what
follows from that: asking for `ROM.1.4` finds nothing in CEV, and that side is `null`.

The other half is not handled. With CEV as the primary and NKJV as the parallel, a tap
on CEV's combined verse reports `ROM.1.3`, and `versePair('ROM.1.3')` then builds:

| Part | Value | From |
|---|---|---|
| primary text | verses 3 and 4 | `verseText` matches the combined element |
| `displayRef` | "Romans 1:3-4" | `refFromHeading` uses the label as printed |
| parallel text | verse 3 only | `verseText` filters on `usfmOf(el) === 'ROM.1.3'` |
| `verseKeys` | `ROM.1.3` | `deriveVerseKeys` |

The note says 3-4, shows NKJV's verse 3 beside CEV's 3 and 4, and is not found by a
lookup of `ROM.1.4`.

Read from the code. **Not measured on a live page**, and the fix depends on things that
have to be measured first.

## Scope

**In:** what a save of a combined verse stores for the other column, and which keys it
is found by.

**Out:** the `null` side for a verse a column lacks, which T-010 already has right.

## Requirements

**R1. Measure before writing code.** On CEV Romans 1 with NKJV parallel, record what
`data-usfm` holds on the combined element and whether every `+`-joined value is always
a run of consecutive verses in one chapter. Look for at least one more combined verse
in another version, because one example is not a rule. The answers go in
`03-columns-and-versions.md`.

**R2.** A save of a combined verse stores, for the other column, the text of every
verse the combined element names.

**R3.** The note is found by each verse it names, so `verseKeys` holds `ROM.1.4` too.

**R4.** Decide where the extra keys come from, and write the decision down. The verse's
stored `usfm` is `ROM.1.3`; whether the draft carries the full list, or `verses` gains
an entry, is a storage-model question and belongs in `02-storage-model.md`.

## Files

- `src/content/capture.js` — `verseText`, `pairSide`, `versePair`
- `src/content/bible-dom.js` — `usfmOf`, if it needs to expose the whole list
- `src/shared/schema.js` — `deriveVerseKeys`, if R4 lands there

## Reference

- `work/understandings/bible-com/03-columns-and-versions.md`
- `work/understandings/bible-com/02-verse-dom.md`
- `work/understandings/extension/02-storage-model.md`

## Acceptance

- [ ] R1's measurements are recorded, with the versions and chapters they came from
- [ ] CEV primary, NKJV parallel, Romans 1:3-4: the saved note holds NKJV's verses 3
      and 4
- [ ] The same note is returned by a lookup of `ROM.1.4`
- [ ] NKJV primary, CEV parallel, Romans 1:4 still saves with a `null` parallel side
