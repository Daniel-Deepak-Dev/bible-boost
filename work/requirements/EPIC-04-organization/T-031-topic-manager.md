# T-031 — Topic manager: create, rename, recolour, reorder

| Field | Value |
|---|---|
| Epic | EPIC-04 Organization |
| Status | Not started |
| Depends on | T-025 |
| Blocks | T-032 |
| Size | M |
| Risk | Low |

## Why

Topics are created inline during a save (T-014), which is right for capture and
wrong for curation. After a few weeks there will be a typo, two topics that
should be one, and an order that no longer reflects what matters.

## Scope

**In:** managing topics in the full page's sidebar.

**Out:** deletion (T-032), nesting (deliberately deferred — see R7).

## Requirements

**R1.** The sidebar lists topics with their colour, name and note count, plus
Uncategorized and Trash as fixed entries at the ends.

**R2. Uncategorized is `topicId: null`, not a topic row.** It is rendered as if
it were one but has no record — this avoids a special row that import, export,
delete and rename would all have to know about. Do not create it in the database.

**R3.** Inline rename: double-click or a menu item, Enter commits, Escape
cancels. A modal for renaming is friction out of proportion to the action.

**R4.** A colour picker with a small fixed palette — around eight colours, drawn
from `--bb-*` tokens so they work in both themes. **Not** a free colour input: an
arbitrary colour will eventually be invisible against one of the two backgrounds.

**R5.** Drag to reorder, persisted in `order`. Reordering rewrites the `order`
field of the affected topics in **one transaction**.

**R6.** Duplicate names are allowed but warned about — two topics called "Faith"
is confusing, not corrupt. Compare case-insensitively after NFC normalization, so
Tamil names compare correctly.

**R7. Nesting is deferred, but `parentId` is already in the schema.** Do not
build the tree UI now. Do not remove the field either — adding it later would be
a migration. Keep any new code written so a tree can be introduced without
restructuring.

**R8.** Selecting a topic filters the list, updates the hash (`#/topic/<id>`),
and shows the topic name as a heading with its count.

**R9.** Counts exclude trashed notes, and update live via `notesRev`.

**R10.** Creating a topic from here selects it immediately, matching the inline
creation flow in T-014.

## Files

- `src/ui/app/topics.js` — new
- `src/ui/notes.js` — sidebar wiring
- `src/background/repo.js` — `topics/update`, `topics/counts`, reorder
- `src/shared/theme.css` — the topic colour palette

## Reference

- `work/understandings/extension/02-storage-model.md` — the topic record,
  `parentId` reserved, Uncategorized is null
- `work/understandings/extension/03-messaging.md` — the topic message catalogue
- `work/understandings/conventions/02-css-and-theming.md` — token-based colours
- `work/understandings/bible-com/07-i18n-and-scripts.md` — NFC before comparing

## Acceptance

- [ ] Topics list with colour, name and live note count
- [ ] Uncategorized shows notes with `topicId: null` and has **no** database row
- [ ] Inline rename commits on Enter, cancels on Escape
- [ ] Every palette colour is legible in both light and dark
- [ ] Drag-reorder persists across reload, in one transaction
- [ ] A duplicate name warns but is allowed
- [ ] A Tamil topic name can be created, renamed and sorted correctly
- [ ] Selecting a topic filters the list and updates the hash
- [ ] Counts exclude trashed notes and update without a refresh
- [ ] `parentId` is present on every topic record, defaulting to null

## Notes

R4 looks like a restriction and is actually a kindness — the alternative is a
user picking a dark blue that vanishes in dark mode and reporting it as a bug.
