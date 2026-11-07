# BibleBoost — instructions for AI agents

A Chrome MV3 extension that enhances reading on bible.com. Vanilla JavaScript,
**zero dependencies, no build step**, loaded unpacked.

## Read this first

| If you are... | Read |
|---|---|
| Starting a task | [`work/requirements/README.md`](work/requirements/README.md), then the task file, then the understanding files it links to |
| Touching bible.com's DOM | [`work/understandings/bible-com/`](work/understandings/README.md) — **before writing code** |
| Adding any DOM to a bible.com page | [`extension/04-observer-hazards.md`](work/understandings/extension/04-observer-hazards.md) |
| Reading or writing notes data | [`extension/02-storage-model.md`](work/understandings/extension/02-storage-model.md) |
| Adding a module | [`extension/01-architecture.md`](work/understandings/extension/01-architecture.md) |
| Writing any code | [`conventions/01-code-style.md`](work/understandings/conventions/01-code-style.md) |

**Do not guess about bible.com's DOM.** It has been studied in detail, and
several obvious assumptions are documented as wrong. Guessing is how this project
gets bugs.

## Hard rules

1. **No dependencies, no build step, no `package.json`.** If a change seems to
   need one, it is the wrong change. ES modules work natively in the service
   worker (`"type": "module"`) and in extension pages — that is enough.

2. **Never `innerHTML`.** Build DOM with `createElement` + `textContent`. Commit
   `c41bdd0` made this choice deliberately, and note bodies are user content that
   can arrive from an imported file.

3. **Never re-render, remove or reorder bible.com's own DOM.** The founding rule:
   BibleBoost adds, so that Highlight, Copy, Compare and Share keep working.

4. **Everything injected into a bible.com page carries `data-bb-own`.** The
   observer guard depends on it; without the marker, your UI re-runs a full
   alignment pass on every mutation.

5. **Match structure, never a hashed class.** bible.com uses CSS modules. Use
   `[class*="_verse"]` substring matching, `data-usfm`, or structural tests. An
   exact class name will break.

6. **The service worker is the only IndexedDB client.** Ids, validation,
   normalization and search live there. Content scripts send raw drafts.

7. **`normalize('NFC')` then `toLocaleLowerCase()`.** Never `toLowerCase()`,
   never `\b`, no stemming. The content is Tamil and English. A Latin-only
   assumption is a bug.

8. **Compare before writing to storage.** `storage.sync` fails silently past
   ~120 writes/minute. Follow the `remember()` pattern in `content.js`.

## Code style

Match the existing source — a reviewer should not be able to tell which files are
new. 2-space indent, single quotes, semicolons, trailing commas, camelCase
functions, `SCREAMING_CASE` constants, `*_RE` regexes, `bb-` prefix on every
injected attribute and CSS custom property, `// ---------- Section ----------`
banners.

**Comments explain *why*, at length, citing measured values and specific
verses.** This is the codebase's distinguishing quality. For example:

> Note it does NOT match on class name. bible.com's current build emits a plain
> "_s" with no digit, which is why the old /_s\d/ test never once fired on a live
> page.

Write comments like that. Terse "what" comments are a downgrade here.

## When you finish a task

1. Work the task's **Acceptance** checklist and tick only what you verified
2. If you touched page DOM: confirm alignment, separators and `Alt+P/A/S` still
   work on a live parallel chapter
3. Set `Status` to `Done` in the task file
4. **Record what you learned** in `work/understandings/` — anything a future
   session would otherwise have to rediscover. If a file there is wrong, fix it
   in the same change.

Step 4 is not bookkeeping. It is the main defence against the same bug being
found twice.

## Tests

```bash
node --test test/
```

Node 18+ built-in runner. **No `package.json`, no dependencies.** Covers pure
logic only — refs, normalization, CSV, migrations, search ranking. Keep
`src/shared/*` free of `chrome.*` and DOM APIs so it stays runnable there.

DOM and integration behaviour is verified by hand, per each task's acceptance
list.

## Layout

```
manifest.json  content.js  content.css  popup.*   existing extension
background.js                           service worker (module)
src/shared/      pure, testable, no browser APIs
src/background/  db, repo, search, io — the only IndexedDB client
src/content/     classic scripts, share the BB namespace, order matters
src/ui/          panel.html and notes.html, same app in two hosts
test/            node --test
work/            requirements and understandings — no runtime code
```

## Scope discipline

Stay inside the task's **Scope / Out** list. If you find other work, write a new
task file — `B-NNN` in `work/requirements/EPIC-08-maintenance/` for a defect —
rather than widening the one you are on.

## Git

**Work on `main`. Never create a branch unless the user explicitly asks for
one.** This is a solo repository with a linear history and no pull-request
workflow — a branch only adds a merge step nobody wanted. If a general default
says to branch before committing on the default branch, **that default does not
apply here**; this instruction overrides it.

Commit only when asked. Push only when asked.

Commit messages are conventional and imperative, explaining *why* in the body
when it is not obvious. Reference the task id:

```
T-004: guard the observer against BibleBoost's own DOM
```
