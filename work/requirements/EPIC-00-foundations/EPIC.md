# EPIC-00 — Foundations

**Goal:** put the data layer, the message router and the safety guards in place,
so every later epic builds on one definition of a note instead of three.

**User-visible change: none.** That is deliberate. Everything here exists because
three later requirements — CRUD consistency across surfaces, search across
tags/topics/notes, and import/export that round-trips — all quietly depend on a
single authority for the data.

## Tasks

| Id | Title | Depends on |
|---|---|---|
| [T-001](T-001-extract-bible-dom.md) | Extract bible.com DOM readers into `BB.dom` | — |
| [T-002](T-002-service-worker.md) | Module service worker and message router | — |
| [T-003](T-003-database-and-schema.md) | IndexedDB, schema and migration ladder | T-002 |
| [T-004](T-004-observer-guard.md) | Observer ignore-guard for BibleBoost's own DOM | — |
| [T-005](T-005-repo-crud.md) | `repo.js` — CRUD, soft delete, `bumpRev()` | T-003 |
| [T-006](T-006-shared-theme.md) | Shared `--bb-*` theme token file | — |
| [T-007](T-007-test-harness.md) | `node --test` harness for pure logic | — |

T-001, T-002, T-004, T-006 and T-007 are independent and can be done in any
order. T-003 needs T-002. T-005 needs T-003.

## Definition of done

- [x] A note can be created, read, updated and soft-deleted through the worker,
      from a scratch page, with nothing else built — run by hand in the loaded
      extension on 2026-11-09, from the popup's console. That is an extension
      page, so no separate scratch page was needed. The script and the result
      are in T-005's Notes.
- [x] `sh work/status.sh` shows all seven Done
- [x] Parallel alignment and separators behave exactly as before — verified by
      hand on a live chapter. Recorded in T-001's Acceptance (2026-11-08) and
      T-004's Notes (2026-11-09, on the last commit to touch page-side code).
- [x] `node --test` passes
- [x] No new dependency, no `package.json` in the extension root

## Risks

**T-001 touches working alignment code.** It is a pure move with no behaviour
change, but alignment is the project's flagship feature and the code is subtle.
Verify by hand, not by reading.

**T-004 is the one that prevents a performance bug** which will otherwise appear
in EPIC-02 and be hard to attribute. Do it before any page-side UI lands.
