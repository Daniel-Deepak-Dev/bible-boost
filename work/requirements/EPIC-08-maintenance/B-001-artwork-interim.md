# B-001 — Icon artwork is marked INTERIM over trade dress

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Pre-existing debt |
| Blocks release | **Yes** |
| Size | M (design work, not code) |
| Risk | Legal / listing rejection |

## The problem

`icons/ARTWORK.md` line 3 states `STATUS: INTERIM`.

The shipped icons are **original SVGs** — nothing was copied. But the document
records that the **composition** is close to YouVersion's trade dress: a
closed-book-with-bookmark layout in a similar palette. Trade dress protects the
overall look, not just the literal artwork, so "we drew it ourselves" is not by
itself a defence.

The same document notes that the packaging script refuses to build a store zip
while the marker says INTERIM — a guard that cannot currently fire, because that
script does not exist (see [B-002](B-002-missing-package-script.md)).

## Why it matters now

This blocks a Chrome Web Store submission independently of the notes project.
Discovering it after seven epics of work, at the point of submitting, is the
expensive way to find out.

It is also the kind of problem that gets worse with success: the more users the
extension has when a complaint arrives, the more disruptive the change is.

## What is already specified

`icons/ARTWORK.md` contains the replacement design brief:

- an **open** book, not closed with a bookmark
- burgundy `#8E1F2F` or `#7B2238`
- cream `#F7EDE2`
- amber `#F5A524`
- **no text** in the icon
- **not** a closed-book-with-bookmark layout

It also documents the re-render commands.

So this is execution of an existing brief, not a design decision to be made from
scratch.

## Scope

**In:** producing the replacement artwork, rendering it, updating the marker.

**Out:** rebranding anything else — the name, the popup, the colours in the UI.

## Acceptance

- [ ] New SVG sources in `icons/v3-svg/` following the brief in `ARTWORK.md`
- [ ] The composition is clearly distinct from YouVersion's — an open book, no
      bookmark
- [ ] All four PNG sizes rendered and verified, using the documented commands
- [ ] Legible at 16px, which is where most icon designs fail
- [ ] Works on light and dark browser toolbars
- [ ] `icons/ARTWORK.md` `STATUS:` changed from `INTERIM`, with a line recording
      what changed and when
- [ ] The old icons are kept in `icons/v2-svg/` for reference, not deleted
- [ ] `other-resource/icons-archive/` remains gitignored and unshipped

## Notes

`other-resource/icons-archive/NOTE.txt` says "ARCHIVED — DO NOT SHIP, DO NOT
COMMIT" and holds the YouVersion-derived originals. `.gitignore` keeps
`/other-resource` out of git. **Verify that is still true** before any packaging
work, and never let a packaging script sweep that folder in.
