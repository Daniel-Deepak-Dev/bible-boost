# T-055 — Performance pass and release checklist

| Field | Value |
|---|---|
| Epic | EPIC-07 Polish and release |
| Status | Not started |
| Depends on | all |
| Size | M |
| Risk | Low |

## Why

Performance problems in an extension like this are cumulative: each feature adds
a little work to a page that re-renders constantly, and none of them is slow on
its own. The only way to catch that is to measure the whole thing at the end, on
a long chapter, with real data.

The checklist also exists so that "is this ready?" has an answer that is not an
opinion.

## Scope

**In:** measuring, fixing what the measurements find, and a final verification
sweep.

**Out:** new features.

## Requirements

**R1. The `align()` budget.** With the panel open, a note being edited, the save
chip visible and `DEBUG_SCHEDULE = true`, confirm that typing produces **zero**
`schedule()` calls. This is T-004's guard verified under full load rather than in
isolation, and it is the single most important performance check in the project.

**R2.** Measure on **Psalm 119** — 176 verses, parallel, with separators on.
That is the project's worst case for `align()`, and a short chapter will hide
every problem here.

**R3.** Seed a realistic collection — 2000 notes, 30 topics, 80 tags, a mix of
Tamil and English — and verify:

| Operation | Target |
|---|---|
| Panel open to first paint | < 300ms |
| Search query | < 100ms |
| Index rebuild from cold | < 200ms |
| List scroll | no dropped frames |
| Bulk retag of 200 notes | < 2s, UI responsive |

**R4.** Verify the page is restored completely when the extension is disabled
with the panel pinned: no width constraint, no injected nodes, no inline styles
on bible.com elements.

**R5.** Memory: open the panel, navigate twenty chapters, confirm the DOM node
count and listener count are stable. Detached nodes and leaked listeners are the
likely failure given how often this page re-renders.

**R6.** Run the full manual matrix from `ROADMAP.md`'s verification section, plus
every epic's definition of done.

**R7.** `node --test` passes, with no `package.json` and no
`node_modules` anywhere in the repo.

**R8.** Audit the manifest: every permission justified, `web_accessible_resources`
scoped to bible.com and not `<all_urls>`, no leftover debug flags set true.

**R9.** Grep the codebase for the hard rules: no `innerHTML`, no `\b` in any
normalization path, no `toLowerCase()` where `toLocaleLowerCase()` is meant, no
empty `catch`, `data-bb-own` on every injected node.

**R10.** Confirm EPIC-08's blockers are resolved or consciously deferred with a
recorded decision.

**R11. Update `work/understandings/`** with everything learned across the whole
project that is not yet written down. This is the last chance to capture it while
it is still in anyone's head.

## Files

- Everything; changes should be fixes, not features.

## Reference

- `ROADMAP.md` — the manual verification matrix
- `work/understandings/extension/04-observer-hazards.md` — the `align()` cost
- Every epic's `EPIC.md` definition of done

## Acceptance

- [ ] R1 verified: typing with everything open produces zero `schedule()` calls
- [ ] Psalm 119 parallel with the panel pinned feels as responsive as without
- [ ] Every target in R3 met with 2000 notes
- [ ] Disabling the extension with the panel pinned leaves a pristine page
- [ ] Twenty chapter navigations leave node and listener counts stable
- [ ] The full manual matrix passes
- [ ] Every epic's definition of done is ticked
- [ ] `node --test` passes on a clean checkout with no install
- [ ] Manifest audited; no debug flag left on
- [ ] The R9 greps come back clean
- [ ] EPIC-08 resolved or deferred with a recorded decision
- [ ] `work/understandings/` updated

## Notes

R1 and R2 together are the real test. Every individual task checked the observer
guard in isolation; this is the only point where the guard is checked with every
consumer of it present at once, on the page that punishes it most.
