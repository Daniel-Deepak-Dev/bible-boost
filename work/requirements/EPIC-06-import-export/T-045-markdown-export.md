# T-045 — Markdown export

| Field | Value |
|---|---|
| Epic | EPIC-06 Import and export |
| Status | Not started |
| Depends on | T-042 |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

This replaced XML in the original request, because Markdown is where Bible study
notes actually want to end up — Obsidian, Notion, Logseq — and XML had no
consumer.

It is also the format that survives the extension. A folder of Markdown files is
readable in thirty years with no software at all, which matters for a local-only
notes collection.

One-way by design: Markdown is for leaving with, JSON is for coming back with.

## Scope

**In:** the Markdown writer, its structure and frontmatter.

**Out:** importing Markdown — deliberately not supported.

## Requirements

**R1.** Two output modes:

- **One combined document**, grouped by topic with `##` headings per topic and
  `###` per note. Good for reading and printing.
- **One file per note**, delivered as a zip, with topics as folders. Good for
  Obsidian.

Start with the combined document; the per-note mode may follow.

**R2.** YAML frontmatter on each note, since Obsidian and Logseq both read it:

```yaml
---
id: n_xxxx
title: "..."
topic: "Exodus study"
tags: [faith, covenant]
refs: [EXO.13.2, EXO.13.3]
created: 2026-11-08T00:00:00.000Z
updated: 2026-11-08T00:00:00.000Z
---
```

**R3.** The verse block renders as a blockquote **above** the body, with both
versions labelled by abbreviation:

```markdown
> **TAOVBSI** — <Tamil text>
>
> **NKJV** — Then the LORD spoke to Moses, saying,
```

**R4.** The body is emitted as-is. It is already Markdown — do not escape it, do
not re-render it, do not reformat it.

**R5.** Escape YAML values properly. A title containing `:` or `"` breaks
frontmatter in a way that makes the file silently unimportable in Obsidian.
Quote and escape, or use block scalars.

**R6.** Zip without a dependency. If per-note mode is built, write a minimal
store-only (no compression) zip writer — the format is simple and this is a
no-dependency project. If that proves disproportionate, ship combined mode only
and say so.

**R7.** UTF-8, no BOM. Markdown tooling does not expect one.

**R8.** Sanitize filenames in per-note mode: a topic or title containing `/`,
`\`, `:` or `..` must not produce a path outside the archive.

**R9.** Heading levels inside a note body may collide with the document's own
`##`/`###` structure. Either demote the body's headings in combined mode, or
accept the collision and document it. **Decide and comment.**

## Files

- `src/background/io.js` — the Markdown writer
- `src/background/zip.js` — only if per-note mode is built
- `test/io.test.js`

## Reference

- `work/understandings/extension/02-storage-model.md` — body is Markdown source
- `work/understandings/bible-com/07-i18n-and-scripts.md` — no BOM

## Acceptance

- [ ] The combined document opens in Obsidian with topics as headings
- [ ] Frontmatter parses — verify in Obsidian, not just by eye
- [ ] A title containing `:` and `"` does not break frontmatter
- [ ] The verse blockquote shows both versions, labelled
- [ ] Tamil text renders correctly in Obsidian
- [ ] A body with its own headings and lists survives unchanged
- [ ] Heading collision is handled per R9 and the choice is commented
- [ ] If per-note mode ships: the zip opens, and a hostile topic name cannot
      escape the archive
- [ ] No dependency was added

## Notes

R5 is the one that fails quietly. Obsidian does not error on broken frontmatter —
it just shows it as body text, and the user does not notice until later.
