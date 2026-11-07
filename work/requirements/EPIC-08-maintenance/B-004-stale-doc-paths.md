# B-004 — Stale paths in docs and script headers

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Pre-existing debt |
| Blocks release | No |
| Size | XS |
| Risk | Low |

## The problem

Three small documentation inaccuracies, found while mapping the codebase:

| Where | Says | Reality |
|---|---|---|
| `icons/v2-svg/render-icons.ps1` header | `icons\render-icons.ps1` | the file is in `icons\v2-svg\` |
| `icons/ARTWORK.md:5` | `tools/package.ps1` | does not exist — see [B-002](B-002-missing-package-script.md) |
| `README.md:6` | "Unzip" | nothing in the repo produces a zip — also B-002 |

## Why it matters

Individually these are trivial. Together they are a small signal worth
correcting, because this codebase's distinguishing quality is that its comments
are **trustworthy** — they record measured values, specific verses and real
bible.com quirks, and that is why a reader can rely on them.

A header comment with the wrong path is the first crack in that. Someone follows
it, finds nothing, and starts checking everything else by hand.

The `work/understandings/` folder makes this more important, not less: the whole
system depends on written knowledge being accurate, and a documented habit of
fixing stale references is what keeps it that way.

## Scope

**In:** correcting the three inaccuracies.

**Out:** writing the packaging script (B-002) or the artwork (B-001) — this task
only makes the documentation honest about their current state.

## Requirements

**R1.** Fix the path in `icons/v2-svg/render-icons.ps1`'s header comment.

**R2.** `icons/ARTWORK.md` must not state that `tools/package.ps1` enforces the
INTERIM guard while no such script exists. Either:

- mark it as **planned**, cross-referencing B-002, or
- resolve B-002 first and leave the claim true.

A documented safety mechanism that does not exist is worse than none, because it
gets relied on.

**R3.** `README.md`'s install instructions must match reality. Until B-002 lands,
describe cloning or downloading the repository and loading it unpacked — not
unzipping something the project does not produce.

**R4.** While here, check the other paths in `ARTWORK.md` and in both icon
scripts against the actual tree, and fix anything else that has drifted.

**R5.** Do **not** "tidy" any of the long explanatory comments in `content.js`
or `content.css` while passing through. They are accurate and load-bearing; this
task is about paths, not prose.

## Acceptance

- [ ] `render-icons.ps1`'s header names its real location
- [ ] `ARTWORK.md` either marks the packaging guard as planned or B-002 is done
- [ ] `README.md`'s install steps work when followed literally on a clean machine
- [ ] Every other path in `ARTWORK.md` and the icon scripts resolves
- [ ] No explanatory comment in `content.js` or `content.css` was touched

## Notes

R3's test is to actually follow the README on a machine without the repo. Install
instructions are written by people who already have everything, which is why they
drift without anyone noticing.
