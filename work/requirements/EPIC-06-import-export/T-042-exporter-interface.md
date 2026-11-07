# T-042 — One exporter interface, three writers

| Field | Value |
|---|---|
| Epic | EPIC-06 Import and export |
| Status | Not started |
| Depends on | T-005 |
| Blocks | T-043, T-044, T-045 |
| Size | S |
| Risk | Low |

## Why

Three formats that each gather their own data, apply their own filters and
produce their own filenames is three places to fix a bug. One pipeline that
gathers once and hands a common shape to a small writer per format is one.

It also makes adding a format later — XML, if a consumer ever appears — a single
small file rather than a feature.

## Scope

**In:** the pipeline, the writer contract, the download mechanism, scoping.

**Out:** the writers themselves (T-043, T-044, T-045).

## Requirements

**R1.** `src/background/io.js` exposes
`exportNotes({ format, scope }) -> { filename, mime, data }`, handled by
`io/export` in the worker.

**R2. Scope** is one of: everything, a topic, a tag, a filter (the current
view), or an explicit id list (a selection from T-027). Resolved once, through
`repo.js` — the writers never query the database.

**R3.** A writer is a pure function `(bundle) -> string`, where the bundle is
`{ meta, topics, tags, notes }`. Pure means testable under `node --test`, which
is where the CSV quoting and Markdown escaping bugs get caught.

**R4.** `meta` carries `{ app: 'bible-boost', kind: 'notes-export', schemaVersion,
exportedAt, counts }` for every format, including the ones that cannot represent
it structurally — Markdown puts it in a header comment, CSV in the filename.

**R5. Trashed notes are excluded** unless the scope explicitly asks for Trash.
Exporting a backup that silently contains deleted notes is wrong in both
directions.

**R6.** Filename pattern: `bibleboost-notes-YYYY-MM-DD.<ext>`, with the scope
appended when it is not everything: `bibleboost-notes-exodus-study-2026-11-08.csv`.
Sanitize the scope name — a topic called `../../x` must not escape.

**R7. Download without the `downloads` permission.** From an extension page,
`URL.createObjectURL` plus an anchor with `download` is enough. Revoke the object
URL afterwards. Keep the permission list minimal.

**R8.** The worker returns data; the **page** triggers the download. A service
worker has no DOM.

**R9.** Show progress and keep the UI responsive for large exports; stream or
chunk rather than building one enormous string where a format allows it.

**R10.** Every export runs in one read transaction, so a concurrent edit cannot
produce a half-consistent file.

## Files

- `src/background/io.js` — new
- `background.js` — the `io/export` handler
- `src/ui/app/io-ui.js` — new, the dialog and download trigger
- `test/io.test.js` — new

## Reference

- `work/understandings/extension/02-storage-model.md` — record shapes, soft
  delete
- `work/understandings/extension/03-messaging.md` — `io/export`
- `work/understandings/extension/05-mv3-constraints.md` — permissions we
  deliberately do not request

## Acceptance

- [ ] `io/export` returns filename, mime and data for a stub writer
- [ ] Scoping by topic, tag, filter and selection each return the right notes
- [ ] Trashed notes are excluded by default
- [ ] A topic named with path characters produces a safe filename
- [ ] The download works with **no** `downloads` permission in the manifest
- [ ] The object URL is revoked after download
- [ ] Exporting 2000 notes does not freeze the UI
- [ ] A writer is callable from `node --test` with a plain bundle object

## Notes

R3 is what makes the next three tasks cheap to verify. If a writer needs the
database, the pipeline is wrong, not the writer.
