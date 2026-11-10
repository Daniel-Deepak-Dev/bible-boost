# BibleBoost — Roadmap

Where BibleBoost is going: from a parallel-reading aid to a study toolkit for
bible.com, in the spirit of Salesforce Inspector Reloaded.

This page is the high-level view. **The tasks live in
[`work/requirements/`](work/requirements/README.md)** — one file per task, with
requirements and acceptance criteria. Run `sh work/status.sh` for the board.

---

## Shipped

- Parallel reading with verse-by-verse alignment
- Verse separators, drawn above section headings
- On-page dock (Parallel / Align switches) and Alt+P / Alt+A / Alt+S
- Remembers both versions and the last chapter
- Popup matched to bible.com's theme, light and dark

---

## In progress: Notes and Study

Save verses locally with notes, tags and topics; manage them from a collapsible
on-page side panel and a dedicated full-page app; search, import and export.

### Epics

| Epic | Goal |
|---|---|
| [EPIC-00](work/requirements/EPIC-00-foundations/EPIC.md) | Foundations — data layer, service worker, guards |
| [EPIC-01](work/requirements/EPIC-01-capture/EPIC.md) | Capture — save a verse from bible.com |
| [EPIC-02](work/requirements/EPIC-02-side-panel/EPIC.md) | Side panel — the on-page notes panel |
| [EPIC-03](work/requirements/EPIC-03-full-page/EPIC.md) | Full page — the dedicated notes app |
| [EPIC-04](work/requirements/EPIC-04-organization/EPIC.md) | Organization — topics, tags, trash |
| [EPIC-05](work/requirements/EPIC-05-search/EPIC.md) | Search — bilingual, across every field |
| [EPIC-06](work/requirements/EPIC-06-import-export/EPIC.md) | Import and export — JSON, CSV, Markdown, backup |
| [EPIC-07](work/requirements/EPIC-07-release/EPIC.md) | Polish and release |
| [EPIC-08](work/requirements/EPIC-08-maintenance/EPIC.md) | Maintenance — pre-existing debt |
| [EPIC-09](work/requirements/EPIC-09-version-swap/EPIC.md) | Swap sides — trade the two parallel versions left and right |

### Decisions

| Question | Decision |
|---|---|
| Storage | IndexedDB for notes, topics and tags; storage.local for UI state; storage.sync untouched |
| Build step | None. An MV3 module service worker owns all data; pages use native ES modules |
| Panel behaviour | Pinned squeezes the reader to about 70%; unpinned overlays like Inspector Reloaded |
| Parallel capture | Both versions' text stored per verse |
| Note body | Markdown source, textarea plus preview |
| Topics | Exactly one topic per note, plus many tags. parentId reserved for nesting |
| Export | JSON (lossless), CSV (UTF-8 with BOM), Markdown. No XML |
| Delete | Soft delete plus undo toast. Modals only for irreversible actions |

The reasoning behind each of these is in
[`work/understandings/`](work/understandings/README.md).

### Architecture in one paragraph

The service worker is the **only** IndexedDB client. MV3 allows it to be a real
ES module without a bundler, so ids, validation, normalization and search live
in exactly one place. Content scripts stay classic and send raw drafts. The side
panel and the full page are the same application in two hosts, sharing the
modules in `src/ui/app/`. Change propagation uses a notesRev counter in
storage.local, the same pattern content.js already uses for settings.

Full detail: [`work/understandings/extension/01-architecture.md`](work/understandings/extension/01-architecture.md)

---

## Known risks

1. **Notes are local only.** Clearing browsing data or removing the extension
   destroys them. Mitigated by unlimitedStorage, storage.persist(), one-click
   backup and an export reminder — not solved. Sync is post-v1; the schema
   allows it without a migration.
2. **Menu injection is fragile.** bible.com's verse menu is React-rendered with
   hashed class names. An independent save path exists so the feature degrades
   instead of dying.
3. **The body-wide MutationObserver runs align() on every fire.** Any DOM
   BibleBoost adds re-triggers a full layout pass. Guarded by T-004.

## Blocked before any store submission

Both tracked in [EPIC-08](work/requirements/EPIC-08-maintenance/EPIC.md):

- **B-001** — icons/ARTWORK.md still says STATUS: INTERIM; the icon composition
  is close to YouVersion's trade dress and needs the replacement design
- **B-002** — tools/package.ps1 is referenced by ARTWORK.md but does not exist,
  so the INTERIM guard it describes cannot actually fire

---

## Later

Local highlight overlay, reading plans, cross-references, note templates, cloud
sync, verse-of-the-day capture, study-session timer.
