# T-033 — Tag manager: rename, merge, recolour, delete

| Field | Value |
|---|---|
| Epic | EPIC-04 Organization |
| Status | Not started |
| Depends on | T-025 |
| Blocks | — |
| Size | M |
| Risk | Medium — every operation rewrites many notes |

## Why

Tags are typed freely during capture, which guarantees drift: `faith`, `Faith`,
`faithfulness`, `fatih`. Normalization catches the casing; nothing catches the
rest. Without a manager, the tag list becomes noise and tag filtering stops being
useful.

Every operation here rewrites notes in bulk, which makes the warning policy
matter.

## Scope

**In:** managing tags across the whole collection.

**Out:** adding and removing tags on a single note (T-022, T-026).

## Requirements

**R1.** A tag list — in the sidebar or its own view — showing each tag's label,
colour and usage count, sorted by count or alphabetically with `Intl.Collator`.

**R2. Rename rewrites every note that carries the tag**, in one transaction, and
updates the `tags` row. Show the count before committing: "Rename 'faith' on 40
notes?"

**R3.** If the new name collides with an existing tag, offer to **merge** rather
than failing. A collision is almost always what the user meant.

**R4. Merge** takes several tags into one: every note carrying any of them gets
the target tag, the sources are removed, duplicates collapse. Confirm with the
affected note count.

**R5.** Colour from the same fixed palette as topics, so tag chips and topic dots
read as one system and every colour works in both themes.

**R6. Delete** removes the tag from every note that carries it. This is
**irreversible for the association** — the notes survive, the link does not — so
confirm with the count, and provide undo that restores the associations.

**R7.** Normalize with NFC + `toLocaleLowerCase()` before comparing, always.
`toLowerCase()` is wrong for non-Latin scripts, and an unnormalized Tamil tag
will compare unequal to a visually identical one.

**R8.** Keep `name` (normalized, the key) and `label` (what the user typed)
distinct. Rename changes both; merge keeps the target's label.

**R9.** Orphan cleanup: a tag row whose usage count reaches zero through normal
editing is removed automatically. Do not accumulate dead rows.

**R10.** Every operation goes through `repo.js` in one transaction and bumps
`notesRev` **once**, not once per note.

**R11.** Show which tags are unused, so the list can be tidied deliberately.

## Files

- `src/ui/app/tags.js` — new
- `src/background/repo.js` — `tags/rename`, `tags/merge`, `tags/delete`
- `src/shared/normalize.js` — the shared normalizer
- `test/normalize.test.js` — Tamil cases

## Reference

- `work/understandings/bible-com/07-i18n-and-scripts.md` — **normalization rules;
  read before writing any comparison**
- `work/understandings/extension/02-storage-model.md` — the tag record,
  `name` vs `label`
- `work/understandings/extension/03-messaging.md` — the tag message catalogue
- `work/requirements/EPIC-04-organization/EPIC.md` — the warning policy

## Acceptance

- [ ] The tag list shows accurate live usage counts
- [ ] Renaming a tag used by 40 notes updates all 40, in one transaction, with
      one `notesRev` bump
- [ ] Renaming onto an existing tag offers merge
- [ ] Merging three tags leaves one, with no duplicates on any note
- [ ] Deleting a tag confirms with the count and can be undone
- [ ] `Faith`, `faith` and `FAITH` are one tag throughout
- [ ] A Tamil tag survives rename and merge unchanged, and a decomposed form
      matches a composed one
- [ ] A tag that reaches zero usage disappears from the list
- [ ] Unused tags are identifiable
- [ ] A failure midway leaves every note unchanged
- [ ] `node --test test/normalize.test.js` covers the Tamil composed/decomposed
      case

## Notes

R7 is the one that will be got wrong. `toLowerCase()` looks identical to
`toLocaleLowerCase()` in English testing and diverges silently elsewhere.
