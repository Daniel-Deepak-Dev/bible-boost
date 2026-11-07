# T-040 — Shared search bar for panel and full page

| Field | Value |
|---|---|
| Epic | EPIC-05 Search |
| Status | Not started |
| Depends on | T-036 |
| Blocks | — |
| Size | M |
| Risk | Low |

## Why

Search has to be in both surfaces, and it has to be the same search — a result
that appears in the full page but not in the panel is a bug the user will never
be able to describe.

One component, two densities, same behaviour. This is architecture rule 3 applied
again.

## Scope

**In:** the search input, results presentation, highlighting, keyboard handling.

**Out:** the index and ranking (T-036), the query parser (T-039).

## Requirements

**R1.** `src/ui/app/search-bar.js`, imported unchanged by both hosts. Density is
an option; behaviour is not.

**R2.** Debounce input by ~200ms. Every keystroke hitting the worker is wasteful,
and a shorter debounce makes results flicker as they narrow.

**R3.** **Highlight matches** in the result rows, using the match metadata from
T-036's R5 — do not re-search in the UI, and do not highlight by string
replacement into HTML. Build highlighted spans with `createElement` +
`textContent`. Note bodies are user content; this is hard rule 1.

**R4.** Show where the match was — body, verse text, tag, title — because "why is
this in my results" is otherwise a mystery when the match is in a verse the row
does not display.

**R5.** When the match is in verse text, show that snippet rather than the body
preview. That is the whole value of indexing both versions.

**R6.** Show the result count, and when the substring fallback contributed,
separate "partial matches" below the exact ones (T-038's R4).

**R7.** In the panel, search composes with the chapter scope from T-023 — show
clearly whether the search is within the current chapter or across everything,
and make it one tap to widen. Searching "all notes" while the panel silently
filters to one chapter is a confusing failure.

**R8.** Keyboard: `/` or Ctrl/Cmd+F focuses it, Escape clears and returns focus
to the list, arrows move through results, Enter opens.

**R9.** Overriding Ctrl/Cmd+F is acceptable **inside the panel and the notes
page**, but **never** on the bible.com host page — the user's browser find must
keep working there.

**R10.** The empty-result state suggests something useful: widen the scope, clear
a filter, check spelling. Distinguish "no matches" from "no notes at all".

**R11.** Compact in the panel — one input, no visible filter row until something
is typed. The compactness requirement still applies.

**R12.** Parsed filters (T-039) appear as removable chips, so the syntax is
discoverable.

## Files

- `src/ui/app/search-bar.js` — new, shared
- `src/ui/app/list.js` — highlighting, match context
- `src/ui/panel.js`, `src/ui/notes.js`
- `src/ui/ui.css`

## Reference

- `work/understandings/extension/01-architecture.md` — rule 3
- `work/understandings/conventions/01-code-style.md` — hard rule 1, no
  `innerHTML`
- `work/understandings/extension/03-messaging.md` — `search/query`

## Acceptance

- [ ] The same query returns the same results in panel and full page
- [ ] Matches are highlighted, built without `innerHTML`
- [ ] A note whose match is in the Tamil verse text shows that snippet
- [ ] The match field is indicated
- [ ] Partial matches are grouped below exact ones
- [ ] In the panel, the search scope is visible and widening is one tap
- [ ] `/` focuses; Escape clears and returns focus; arrows and Enter work
- [ ] Ctrl/Cmd+F is **not** overridden on the bible.com page itself
- [ ] A body containing HTML-looking text highlights as visible text, executing
      nothing
- [ ] The empty state distinguishes no-matches from no-notes
- [ ] At 280px the search bar does not crowd the list

## Notes

R9 is easy to get wrong by registering the shortcut in the content script. The
panel is an iframe — its own keydown handler is the right place, and it will not
reach the host page.
