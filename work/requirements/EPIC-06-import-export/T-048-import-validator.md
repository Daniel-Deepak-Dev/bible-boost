# T-048 — Shared import validator

| Field | Value |
|---|---|
| Epic | EPIC-06 Import and export |
| Status | Not started |
| Depends on | T-005 |
| Blocks | T-046, T-047 |
| Size | M |
| Risk | **High if skipped** — this is the trust boundary |

## Why

**An imported file is untrusted input.** It may be hand-edited, produced by
another tool, truncated, or deliberately hostile. It is the only path by which
data the user did not type reaches the database and then the DOM.

Do this **before** either import task. Building the importers first and adding
validation afterwards means the unvalidated path exists, gets used in testing,
and is easy to leave in.

## Scope

**In:** one validator, used by every import path.

**Out:** parsing the file formats (T-046, T-047).

## Requirements

**R1.** `validateImport(bundle) -> { valid, records, problems }`, in
`src/shared/schema.js` or a sibling. **Pure** — no `chrome.*`, no DOM — so it is
testable under `node --test` and reusable anywhere.

**R2. Reuse the create path's validator.** An imported note must satisfy exactly
the same rules as one created in the UI. If the rules diverge, import becomes a
back door around them. Extract the shared predicate rather than writing a second
one.

**R3.** Per record: check required fields, types, and shapes — `verses` is an
array of `VerseRef`, `tags` is an array of strings, timestamps parse as dates,
`usfm` matches the canonical pattern.

**R4. Reject, do not coerce, where meaning would change.** A `body` that is a
number is a corrupt record, not a record needing `String()`. Coerce only where
the intent is unambiguous — trimming whitespace, normalizing a tag.

**R5.** Report **every** problem with its record index and field, not just the
first. A user fixing a 300-note file one error per attempt will give up.

**R6.** A bad record is skipped, not fatal. Import what is valid, report what was
not, and let the user decide. An all-or-nothing import of a slightly broken
backup is the worst outcome.

**R7. Caps, to prevent a file from being a denial of service:**

| Field | Cap |
|---|---|
| body | ~1 MB |
| title | ~1 KB |
| tags per note | ~100 |
| verses per note | ~500 |
| notes per import | ~50,000 |

Report, do not truncate silently.

**R8. Never trust ids.** An id from a file is a **matching hint** for T-046's
strategies, never a guarantee. Validate its shape. Never let a file set a field
the application computes — `verseKeys` is recomputed, always.

**R9. Markdown bodies are rendered later** by T-026's renderer, which is already
required to be injection-safe. The validator does **not** sanitize Markdown — it
checks shape. Keeping the two concerns separate means neither is skipped on the
assumption the other handled it. Note this explicitly in a comment.

**R10.** Validate the envelope too: `app`, `kind`, `schemaVersion`. A newer
`schemaVersion` than the code's is refused with a clear message. An older one is
run through the migration ladder.

**R11.** `test/import.test.js` covers: a valid bundle, a missing required field,
a wrong type, an oversized body, a hostile `usfm`, a future `schemaVersion`, and
a bundle where half the records are bad.

## Files

- `src/shared/schema.js` — the shared validator
- `src/background/io.js` — call it
- `test/import.test.js` — new

## Reference

- `work/understandings/extension/02-storage-model.md` — normative shapes;
  `verseKeys` is derived
- `work/requirements/EPIC-06-import-export/EPIC.md` — the untrusted-input rule
- `work/understandings/conventions/01-code-style.md` — hard rule 1

## Acceptance

- [ ] A valid bundle validates with no problems
- [ ] A note missing `id` or with a malformed one is reported, not imported
- [ ] A `body` that is a number is rejected, not coerced
- [ ] All problems are reported at once, with index and field
- [ ] A bundle with 3 bad records out of 10 imports 7 and reports 3
- [ ] A 10 MB body is rejected with a clear message
- [ ] `verseKeys` present in a file is ignored and recomputed
- [ ] A future `schemaVersion` is refused with a clear message
- [ ] An older `schemaVersion` runs the migration ladder
- [ ] The validator imports nothing browser-specific
- [ ] `node --test test/import.test.js` covers all seven cases

## Notes

R2 is the structural requirement. Two validators will drift, and the one that
drifts is always the import one, because it is exercised less.
