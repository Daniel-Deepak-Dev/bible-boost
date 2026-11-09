# Requirements

Epics, tasks and bugs for BibleBoost. **What** to build and **why**.
For **what is true** about bible.com and this codebase, see
[`../understandings/`](../understandings/README.md).

## How to use this

1. Pick the next task whose **Depends on** entries are all Done
2. Read the task file in full, including its **Reference** section
3. **Read the understanding files it links to** — they exist so you do not have
   to guess about bible.com's DOM
4. Follow [`conventions/03-task-workflow.md`](../understandings/conventions/03-task-workflow.md)

```bash
sh work/status.sh            # the board
sh work/status.sh blocked    # filter by status
```

The `Status` line inside each task file is the single source of truth. This page
is an index, not a board.

## Epics

| Epic | Goal | Tasks |
|---|---|---|
| [EPIC-00](EPIC-00-foundations/EPIC.md) | **Foundations** — data layer, worker, guards | T-001 … T-007 |
| [EPIC-01](EPIC-01-capture/EPIC.md) | **Capture** — save a verse from bible.com | T-008 … T-016 |
| [EPIC-02](EPIC-02-side-panel/EPIC.md) | **Side panel** — the on-page notes panel | T-017 … T-024 |
| [EPIC-03](EPIC-03-full-page/EPIC.md) | **Full page** — the dedicated notes app | T-025 … T-030 |
| [EPIC-04](EPIC-04-organization/EPIC.md) | **Organization** — topics, tags, trash | T-031 … T-035 |
| [EPIC-05](EPIC-05-search/EPIC.md) | **Search** — bilingual, across every field | T-036 … T-041 |
| [EPIC-06](EPIC-06-import-export/EPIC.md) | **Import / export** — JSON, CSV, Markdown, backup | T-042 … T-049 |
| [EPIC-07](EPIC-07-release/EPIC.md) | **Polish and release** | T-050 … T-055 |
| [EPIC-08](EPIC-08-maintenance/EPIC.md) | **Maintenance** — pre-existing debt | B-001 … B-008 |

## Suggested order

EPIC-00 → 01 → 02 → 03 → 04 → 05 → 06 → 07, each shippable on its own.

Exceptions worth knowing:

- **T-004** (observer guard) before **any** page-side UI. It prevents a
  performance bug that first appears in EPIC-02 and is hard to attribute.
- **T-048** (import validator) before either import task, not alongside them.
- **T-037** (normalization) is pure functions with tests and can be done at any
  time — doing it early de-risks EPIC-05.
- **B-001** and **B-002** block a store submission and are independent of
  everything else. Resolve them deliberately rather than at submission time.

## Dependency spine

```
T-001 ──┬─> T-008 ──┬─> T-012, T-013, T-015, T-016
        │           │
        ├─> T-009 ──┴─> T-010
        └─> T-011 ─────> T-010

T-002 ──> T-003 ──> T-005 ──> everything that touches data

T-004 ──> T-013, T-015, T-017        (anything adding page DOM)
T-006 ──> T-017, T-025               (anything rendering BibleBoost UI)

T-017 ──> T-018, T-019, T-020, T-021, T-024
T-021 ──> T-022, T-023, T-025
T-025 ──> T-026 … T-029
T-005 ──> T-036 ──> T-038 … T-041
T-048 ──> T-046, T-047
```

## Writing a new task

Copy the shape of an existing one. It must have **Why**, **Scope** (In *and*
Out), numbered **Requirements**, **Files**, **Reference** links, and an
**Acceptance** checklist of things you can actually observe.

A requirement a future session has to interpret is a requirement that will be
implemented wrong.

Ids are global and sequential — `T-NNN` for tasks, `B-NNN` for bugs — so a task
can move between epics without renumbering. When another epic's task turns up a
defect outside its scope, write a `B-NNN` in EPIC-08 rather than widening that
task.
