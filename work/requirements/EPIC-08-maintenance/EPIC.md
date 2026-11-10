# EPIC-08 — Maintenance and pre-existing debt

**Goal:** track the bugs and inconsistencies that exist **before** the notes
project, so they are decisions rather than surprises.

None of these were introduced by the notes work. Two of them block a Chrome Web
Store submission regardless of how good the notes feature is, which is worth
knowing before seven epics are built on top.

## Items

| Id | Title | Blocks release? |
|---|---|---|
| [B-001](B-001-artwork-interim.md) | Icon artwork is marked INTERIM over trade dress | **Yes** |
| [B-002](B-002-missing-package-script.md) | `tools/package.ps1` referenced but absent | **Yes** |
| [B-003](B-003-duplicated-defaults.md) | `DEFAULTS` duplicated across two files | No |
| [B-004](B-004-stale-doc-paths.md) | Stale paths in docs and script headers | No |
| [B-005](B-005-no-www-host.md) | A bare `bible.com` host is not matched | No |
| [B-006](B-006-shortcuts-dead-in-chrome.md) | `Alt+P/A/S` do nothing in a real Chrome | No |
| [B-007](B-007-popup-parallel-disabled.md) | The popup's Parallel switch is disabled on a live chapter | No |
| [B-008](B-008-dock-tokens-no-fallback.md) | The dock reads its theme tokens with no fallback | No |
| [B-009](B-009-schema-duplicates-shared-rules.md) | `schema.js` keeps its own copy of the verse and text rules | No |
| [B-010](B-010-language-without-iso-token.md) | A version with no `iso6393` token saves with no language | No |
| [B-011](B-011-hidden-verse-number.md) | A verse whose number is switched off reads as a continuation fragment | No |

## How these relate to the notes project

**B-003 is the one the architecture already answers.** The duplicated `DEFAULTS`
is the exact problem the service-worker-owns-the-data rule exists to prevent from
recurring. Fixing it is cheap once T-002 lands.

**B-001 and B-002 are release blockers that the notes work will not touch.** They
should be resolved deliberately — not discovered at submission time, after the
feature is finished.

**B-009 is the exception to "none of these were introduced by the notes work".**
It comes from the notes work itself: T-002 and T-007 each defined the same rules,
because T-007's Files list did not include `schema.js`.

## Adding to this epic

When a task in another epic turns up a defect that is **not** in its scope, write
a `B-NNN` file here rather than widening that task. Note which task found it.
