# EPIC-04 — Organization

**Goal:** make topics and tags manageable rather than merely creatable, and make
deletion safe.

By this point a user can save notes, put them in topics and tag them. What they
cannot do is fix a typo in a topic name, merge two tags that mean the same thing,
recover something they deleted, or delete a topic without wondering what happened
to its notes. Those are the operations that decide whether the system stays
usable after a few months.

## Tasks

| Id | Title | Depends on |
|---|---|---|
| [T-031](T-031-topic-manager.md) | Topic manager: create, rename, recolour, reorder | T-025 |
| [T-032](T-032-topic-delete.md) | Topic delete with note reassignment | T-031 |
| [T-033](T-033-tag-manager.md) | Tag manager: rename, merge, recolour, delete | T-025 |
| [T-034](T-034-trash.md) | Trash: restore, delete forever, auto-purge | T-005 |
| [T-035](T-035-undo-toast.md) | Undo toast on every soft delete | T-022 |

## Definition of done

- [ ] Topics can be created, renamed, recoloured, reordered and deleted
- [ ] Deleting a topic never silently orphans its notes
- [ ] Tags can be renamed across every note, merged and deleted
- [ ] Deleted notes are recoverable from Trash and purge after 30 days
- [ ] Every soft delete offers undo
- [ ] Every destructive action's warning is proportionate to its consequence

## The warning policy

Agreed, and applied consistently across the whole application:

| Consequence | Treatment |
|---|---|
| Reversible, affects one thing | just do it; undo toast |
| Reversible, affects many | undo toast, count shown |
| Irreversible, affects one | confirm dialog |
| Irreversible, affects many | confirm **and** type-to-confirm |
| Changes data the user cannot see | always show what will be affected, with counts |

The last row is the one that gets forgotten. Deleting a tag used by 40 notes
changes 40 records the user is not looking at — so the dialog must say "40".
