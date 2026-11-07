# T-026 — Markdown editor with toolbar and preview

| Field | Value |
|---|---|
| Epic | EPIC-03 Full-page app |
| Status | Not started |
| Depends on | T-025 |
| Blocks | T-030 |
| Size | M |
| Risk | Medium — the renderer is a security boundary |

## Why

Note bodies are Markdown source. That choice keeps storage plain text, exports
losslessly to `.md` for Obsidian/Notion, round-trips through JSON and CSV
perfectly, and lets the panel stay a bare textarea.

The full page is where there is room for the writing affordances: a toolbar that
inserts syntax, and a preview.

## Scope

**In:** the toolbar, the renderer, the preview, and verse insertion.

**Out:** the plain textarea the panel uses (T-022) — this extends it, it does not
replace it.

## Requirements

**R1.** The editor stays a **textarea over Markdown source**. No contenteditable.
The toolbar inserts syntax into the text; it does not produce HTML.

**R2.** Toolbar: bold, italic, heading, bullet list, numbered list, quote, code,
link. Each wraps the selection or inserts a placeholder, and keeps the caret
sensible afterwards — a toolbar that loses the caret is worse than no toolbar.

**R3.** Keyboard equivalents: Ctrl/Cmd+B, +I, +K. These are muscle memory and
their absence is noticed immediately.

**R4.** A preview toggle — edit / preview / split, remembered in
`storage.local`.

**R5. Write a small Markdown renderer. Do not add a dependency.** Support
headings, bold, italic, lists, quote, inline code, fenced code, links and line
breaks. That covers study notes; anything beyond it is scope creep.

**R6. The renderer is a security boundary.** Note bodies are user content and can
arrive from an **imported file** (EPIC-06), which is untrusted input.

- Build output with `createElement` + `textContent`. Never `innerHTML`.
- Never emit raw HTML from the source, even if it looks like a tag.
- Allow `http:`, `https:` and `mailto:` link schemes only. Reject `javascript:`
  and `data:`.
- Add `rel="noopener noreferrer"` and `target="_blank"` to links.

This is the project's hard rule 1 at its most load-bearing: here the label
genuinely does come from storage.

**R7.** The verse block for an attached verse renders above the body, showing
both versions, and is **not** part of the editable Markdown. It is structured
data in `verses[]`, not text — keeping it out of the body is what lets export and
search treat it as a field.

**R8.** An "insert reference" action drops a Markdown link to another note or a
verse ref into the body, so notes can reference each other.

**R9.** Autosave on debounce and on blur, as T-022, sending a **patch**.

**R10.** The textarea uses the page's UI font, not the scripture serif, and
handles Tamil input correctly — including IME composition events, which must not
trigger a save mid-composition.

## Files

- `src/ui/app/editor.js` — extended
- `src/ui/app/markdown.js` — new renderer
- `test/markdown.test.js` — new, covering R6
- `src/ui/ui.css`

## Reference

- `work/understandings/conventions/01-code-style.md` — hard rule 1
- `work/understandings/extension/02-storage-model.md` — body is Markdown source;
  verses are structured
- `work/understandings/bible-com/07-i18n-and-scripts.md` — NFC, Tamil input

## Acceptance

- [ ] Bold, italic, heading, lists, quote, code and link all insert correctly and
      leave a sensible caret
- [ ] Ctrl/Cmd+B, +I, +K work
- [ ] Preview renders all supported syntax
- [ ] A body containing `<script>alert(1)</script>` renders as **visible text**,
      executing nothing
- [ ] A link with a `javascript:` scheme does not become a clickable link
- [ ] `node --test test/markdown.test.js` covers both of the above
- [ ] Links open in a new tab with `noopener noreferrer`
- [ ] The verse block shows both versions and cannot be edited as text
- [ ] Typing Tamil with an IME does not save mid-composition or corrupt the text
- [ ] No new dependency was added

## Notes

The two injection acceptance items are not theoretical. EPIC-06 lets a user
import a JSON file, which is exactly the untrusted path this renderer has to
survive. Write those tests first.
