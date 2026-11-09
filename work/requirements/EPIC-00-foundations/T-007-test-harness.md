# T-007 — node --test harness for pure logic

| Field | Value |
|---|---|
| Epic | EPIC-00 Foundations |
| Status | Done |
| Depends on | — |
| Blocks | — (but every later task should add to it) |
| Size | S |
| Risk | Low |

## Why

The project has no tests, no CI and no `package.json`, and that tool-free
character is worth keeping. Node ships a **built-in** test runner (22+ here — see
`conventions/01-code-style.md` for why, and why the command takes no path), so the
pure logic can be covered with **zero dependencies and no manifest file** —
`node --test`.

Pure logic is where silent bugs live: a ref parser that mishandles `1CO`, a
normalizer that uses `toLowerCase()` instead of `toLocaleLowerCase()`, a CSV
writer that forgets the BOM. None of those are visible in a browser until a user
hits them.

## Scope

**In:** the runner convention, the first modules written test-first, and a
documented command.

**Out:** any DOM, integration or browser testing. Those stay manual, per each
task's acceptance list.

## Requirements

**R1.** Tests live in `test/`, named `<module>.test.js`, using
`node:test` and `node:assert/strict`. Run with:

```bash
node --test
```

**R2.** **No `package.json`, no dependencies, no config file.** If a change seems
to need one, it is the wrong change.

**R3.** Modules under test must be importable in plain Node — pure functions, no
`chrome.*`, no DOM. This is a design constraint on `src/shared/*`, not just a
testing detail: keep browser APIs out of those files.

**R4.** Ship these first:

- `refs.test.js` — USFM parsing (`EXO.13.2`, `1CO.1.1`, `3JN.1.1`), the
  combined-verse `+` split, book-intro rejection (`JHN.INTRO1`), range
  collapsing (`EXO.13.2-4`), canonical book ordering
- `normalize.test.js` — NFC normalization, `toLocaleLowerCase`, the
  Unicode-property tokenizer, and an **explicit Tamil case** proving a composed
  and a decomposed form of the same word match

**R5.** `migrate.test.js` arrives with T-003; `csv.test.js` with T-046;
`search.test.js` with T-038. Each of those tasks owns its own test file.
`router.test.js` and `schema.test.js` already arrived with T-002, so `test/`
exists; this task still owns `test/README.md`.

**R6.** Document the command in `README.md` and in
`work/understandings/conventions/01-code-style.md`.

**R7.** Add `test/README.md` stating what belongs here (pure logic) and what does
not (anything needing a browser), so the boundary does not erode.

## Files

- `test/refs.test.js`, `test/normalize.test.js`, `test/README.md` — new
- `src/shared/refs.js`, `src/shared/normalize.js` — new, written against the
  tests
- `README.md` — document the command

## Reference

- `work/understandings/bible-com/07-i18n-and-scripts.md` — the normalization
  rules the tests must enforce
- `work/understandings/bible-com/01-urls-and-routing.md` — USFM book-code shape
  and the `INTRO` case
- `work/understandings/conventions/01-code-style.md`

## Acceptance

- [x] `node --test` passes with no install step, on a clean checkout
- [x] No `package.json` and no `node_modules` anywhere in the repo
- [x] A deliberately broken assertion makes the command exit non-zero
- [x] `refs.js` handles `1CO`, `3JN`, `JHN.INTRO1` and combined `data-usfm`
- [x] `normalize.js` is proven on Tamil input, not only English
- [x] Neither shared module imports anything browser-specific

## Notes

Keeping `src/shared/*` free of browser APIs is what makes this harness possible
at all. Treat an accidental `chrome.` or `document.` in a shared module as a bug.

The clean-checkout item was run on a copy of the tracked and untracked files
(`git ls-files -co --exclude-standard`), because this work was not yet committed
and so a real clone would not have contained it.

Seven deliberate mutations were each confirmed to fail the suite: dropping NFC,
`toLowerCase`, stripping marks in the tokenizer, alphabetical books, no book-code
tiebreak, ignoring the `+`, and duplicates breaking a run.
