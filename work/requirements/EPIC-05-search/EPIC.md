# EPIC-05 — Search

**Goal:** find a note by anything it contains — a word in the body, a tag, a
topic, a reference, or a word in either version's verse text — from both the
panel and the full page.

The defining constraint is that **the content is bilingual**. A note's Tamil
verse text and its English verse text are both searchable content, and the user
may query in either. That rules out the obvious off-the-shelf answers: Lunr,
FlexSearch and friends ship English-centric tokenizers and stemmers that will
quietly mangle Tamil.

So: a small index written here, with normalization rules that are correct for
both scripts, and a substring fallback that catches what tokenization misses.

## Tasks

| Id | Title | Depends on |
|---|---|---|
| [T-036](T-036-search-index.md) | In-memory search index in the worker | T-005 |
| [T-037](T-037-normalization.md) | Script-safe normalization and tokenizing | T-007 |
| [T-038](T-038-substring-fallback.md) | Substring fallback pass | T-036, T-037 |
| [T-039](T-039-query-syntax.md) | Field filters in the query | T-036 |
| [T-040](T-040-search-ui.md) | Shared search bar for panel and full page | T-036 |
| [T-041](T-041-index-invalidation.md) | Lazy rebuild on change | T-036 |

T-037 can be done first and independently — it is pure functions with tests.

## Definition of done

- [ ] A Tamil word found only in the Tamil verse text finds the note
- [ ] An English word found only in the NKJV verse text finds the same note
- [ ] Tags, topic names, references and bodies are all searchable
- [ ] `topic:` `tag:` `ref:` `version:` filters work and combine with free text
- [ ] A two-character query returns sensible results
- [ ] Search works identically in the panel and the full page
- [ ] Results stay correct after notes are added, edited or trashed

## Rules that are not negotiable

From `work/understandings/bible-com/07-i18n-and-scripts.md`:

- `normalize('NFC')` then `toLocaleLowerCase()` — never `toLowerCase()`
- tokenize on Unicode classes, e.g. `/[\s\p{P}]+/u`
- **never** use `\b` — word boundaries are defined on Latin word characters
- no stemming, no Lunr/FlexSearch/elasticlunr
- always keep a substring fallback

Trashed notes are never in results unless the scope is Trash.
