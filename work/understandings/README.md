# Understandings

Durable knowledge about bible.com, Chrome, and this codebase — written so that a
session with **no prior context** can act without guessing.

**If you are an AI picking up a task: read the files your task's Reference
section links to, before writing code.** Most bugs in a project like this come
from assuming how bible.com's DOM behaves. Almost every assumption worth making
has already been tested here, and several turned out to be wrong.

## Confidence labels

Each file states one at the top:

| Label | Meaning |
|---|---|
| **verified** | Confirmed against live pages or the committed source |
| **design decision** | A choice that was made and approved; treat as a rule |
| **partly unverified** | Contains open questions. Inspect before coding, then update the file |

## Index

### bible.com

| File | Read it before |
|---|---|
| [01-urls-and-routing](bible-com/01-urls-and-routing.md) | anything touching URLs, versions, or SPA navigation |
| [02-verse-dom](bible-com/02-verse-dom.md) | **any** work with verses — selectors, keys, text extraction |
| [03-columns-and-versions](bible-com/03-columns-and-versions.md) | parallel mode, version identity, language codes |
| [04-section-headings](bible-com/04-section-headings.md) | alignment or separators |
| [05-theme-and-page-chrome](bible-com/05-theme-and-page-chrome.md) | any new on-page UI |
| [06-verse-action-menu](bible-com/06-verse-action-menu.md) | detecting a selection, the save-to-BibleBoost menu row |
| [07-i18n-and-scripts](bible-com/07-i18n-and-scripts.md) | search, sorting, export, anything measuring text |

### This extension

| File | Read it before |
|---|---|
| [01-architecture](extension/01-architecture.md) | any new module — it defines where code goes |
| [02-storage-model](extension/02-storage-model.md) | any read or write of notes data |
| [03-messaging](extension/03-messaging.md) | adding a message type or a new surface |
| [04-observer-hazards](extension/04-observer-hazards.md) | **adding ANY DOM to a bible.com page** |
| [05-mv3-constraints](extension/05-mv3-constraints.md) | manifest changes, modules, permissions, quotas |

### Conventions

| File | |
|---|---|
| [01-code-style](conventions/01-code-style.md) | formatting, naming, comment style, hard rules |
| [02-css-and-theming](conventions/02-css-and-theming.md) | tokens, theme overrides, on-page CSS |
| [03-task-workflow](conventions/03-task-workflow.md) | how to pick up and finish a task |

## The five findings that cost the most to learn

1. **bible.com's class names are hashed CSS modules.** Matching `/_s\d/` for
   section headings never fired once on a live page. Match structure, or match a
   substring — never an exact class.
2. **The page observer watches `body`; the theme class is on `html`.** Pure CSS
   hides this today. Any JS that needs the theme must add its own observer.
3. **Tamil line boxes are taller than Latin ones.** Two columns' separator
   hairlines landed ~9px apart on 16 of 18 rows of Exodus 13. Measure, never
   calculate, across scripts.
4. **The existing observer runs a full `align()` on every fire.** Adding DOM to
   the page without a guard makes typing re-run layout across every verse.
5. **The parallel column's version abbreviation is not in the URL.** Only its
   numeric id is. Read the abbr from the page, with fallbacks.

## Keeping this folder honest

When you finish a task and you learned something a future session would
otherwise have to rediscover — **write it here**. When you discover that a file
here is wrong, **fix it in the same change**. A stale understanding is worse than
no understanding, because it will be trusted.
