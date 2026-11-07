# BibleBoost architecture

Confidence: **design decision**, approved. Everything here is a rule, not a
suggestion.

## The shape

```
┌─ bible.com tab ────────────────────────────┐     ┌─ service worker (module) ──┐
│  content scripts (classic, isolated world) │     │  the ONLY IndexedDB client │
│   bible-dom.js  content.js                 │◄───►│   db · repo · search · io  │
│   capture.js  menu.js  quickbar.js         │ msg │                            │
│   panel-host.js ──┐                        │     └────────────▲───────────────┘
└───────────────────┼────────────────────────┘                  │ msg
                    │ postMessage                               │
         ┌──────────▼──────────┐          ┌────────────────────┴──┐
         │ panel.html (iframe) │          │ notes.html (full tab)  │
         │   compact app       │          │   full app             │
         └─────────────────────┘          └───────────────────────┘
                  shared view modules under src/ui/app/
```

## The five rules

1. **The service worker is the only thing that touches IndexedDB.**
   Ids, validation, normalization, search and import/export all live there. No
   other context opens the database — not the panel, not the full page, not the
   content script. This is what keeps one definition of a valid note.

2. **The content script sends raw drafts and lets the worker think.**
   It does not generate ids, does not normalize tags, does not validate. It
   gathers what the page knows and posts it. This is why no shared-module
   gymnastics are needed between a classic content script and a module worker.

3. **The panel and the full page are the same application.**
   `panel.html` and `notes.html` both load the modules in `src/ui/app/`. They
   differ in layout and density, not in behaviour. A feature built for one gets
   the other nearly free — and a bug fixed in one is fixed in both.

4. **The panel is an iframe.**
   It gives total CSS isolation from bible.com, which a light-DOM dock does not,
   and it keeps the panel's own DOM churn invisible to the page observer (see
   `04-observer-hazards.md`). The cost is that it cannot read the page — it talks
   to `panel-host.js` by `postMessage` for anything page-shaped.

5. **No build step.** No bundler, no package.json in the extension, no
   dependencies. If a change seems to require one, it is the wrong change.
   See `05-mv3-constraints.md` for why this is possible.

## What goes where

| Need | Lives in |
|---|---|
| Reading bible.com's DOM | `src/content/bible-dom.js` (`BB.dom`) |
| Detecting a selection, extracting verse text | `src/content/capture.js` |
| Injecting into bible.com's menu | `src/content/menu.js` |
| Fallback save affordance + shortcut | `src/content/quickbar.js` |
| Hosting / sizing / theming the panel iframe | `src/content/panel-host.js` |
| Existing alignment and separators | `content.js` (unchanged in spirit) |
| Any read or write of notes data | `src/background/*` |
| Any rendering of notes | `src/ui/app/*` |
| Things both the worker and pages need | `src/shared/*` |

## Why not a framework

The UI is a list, an editor, a few dialogs and a search box. Vanilla DOM with
`createElement` is entirely adequate at this size, matches the existing code, and
keeps the repo readable as plain source — which is itself a feature for a project
whose install instruction is "load unpacked".

If the full-page app ever outgrows this, that is a deliberate decision to make
then, with a migration, not a default to drift into.

## Future features should extend, not bolt on

The longer-term goal is a toolkit (highlights, reading plans, cross-references).
Each of those is: a new object store or two, new worker message types, a new view
module, and possibly a new content-script capture module. None of them should
need to change the five rules above. If one does, update this file and say why.
