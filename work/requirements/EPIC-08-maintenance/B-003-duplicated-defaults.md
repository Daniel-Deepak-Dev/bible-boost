# B-003 — DEFAULTS duplicated across two files

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Pre-existing debt |
| Blocks release | No |
| Depends on | T-002 (service worker) |
| Size | S |
| Risk | Low |

## The problem

The settings object is defined twice:

- `content.js:10` — with the comment "Keep in sync with popup.js"
- `popup.js:1` — the same object

```js
const DEFAULTS = {
  align: true, separators: false,
  primaryId: '111', parallelId: '114',
  lastRef: 'JHN.1', showSwitch: true,
};
```

The comment is honest about the situation, and the duplication was a reasonable
response to a real constraint: content scripts are classic scripts and cannot
`import`, so there was no way to share a module between them without a bundler.

## Why it matters

It works today. It is listed here because it is the **pattern** that the notes
architecture exists to prevent from spreading.

The service-worker-owns-the-data rule in
`work/understandings/extension/01-architecture.md` is a direct response to this:
with three more surfaces about to exist, a copy-paste approach to shared state
would mean four copies of every constant and validator.

[T-001](../EPIC-00-foundations/T-001-extract-bible-dom.md) makes the same
argument about the DOM readers, where duplication would be worse — a copy of a
bible.com selector rots silently when only one copy gets fixed.

## Scope

**In:** removing the duplication now that a shared mechanism exists.

**Out:** changing any setting's name, value or storage area.

## Requirements

**R1.** Define `DEFAULTS` once, in `src/shared/settings.js`.

**R2.** The **popup** imports it directly.
[T-011](../EPIC-01-capture/T-011-version-resolution.md) already made the popup a
`<script type="module">` in order to share the `VERSIONS` table, so this is only
an `import`.

**R3.** The **content script** cannot import. Options, in order of preference:

1. Put `src/shared/settings.js` in the content-script `js` array as the first
   file, exposing `BB.DEFAULTS` — the same approach as T-001's `BB.dom`. This
   requires it to be written as a classic script, which rules out `export`.
2. If it must be an ES module for the popup and worker, keep a generated or
   mirrored classic copy with a **single** "generated from" comment.

**Prefer option 1.** One file, no generation step, consistent with T-001.
`src/shared/versions.js` (T-011) already does this and also serves modules; see
"One file that both kinds of script can load" in
`work/understandings/extension/05-mv3-constraints.md`.

**R4.** Keep `chrome.storage.sync` and the existing key names. The
`store.get(DEFAULTS, cb)` backfill is the project's migration mechanism for
existing installs — changing it would silently reset users' settings.

**R5.** Remove both "keep in sync" comments, since they will no longer be true.

**R6.** Adding a key to the shared object must still migrate existing installs
for free, exactly as the current comment promises.

## Acceptance

- [ ] `DEFAULTS` is defined in exactly one file — verify by grep
- [ ] The popup reads it without a local copy
- [ ] The content script reads it without a local copy
- [ ] Existing installs keep every stored setting after the change
- [ ] Adding a new key backfills for an existing profile
- [ ] Both "keep in sync" comments are gone
- [ ] The dock, the popup switches, the version pickers and `Alt+P/A/S` all still
      work

## Notes

Test R4 with a profile that has non-default settings stored, not a fresh one. A
fresh profile will pass whatever happens, which is exactly why this kind of
regression ships.
