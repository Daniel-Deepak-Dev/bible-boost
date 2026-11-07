# T-054 — README, shortcuts and privacy note

| Field | Value |
|---|---|
| Epic | EPIC-07 Polish and release |
| Status | Not started |
| Depends on | — |
| Blocks | — |
| Size | S |
| Risk | Low |

## Why

The README is currently a good, honest feature doc for a one-feature extension.
After this project it will describe roughly a third of what the extension does,
and will not mention that the notes are destructible — which is the single most
important thing a user needs to know.

## Scope

**In:** user-facing documentation.

**Out:** `work/understandings/`, which is for implementers, and `ROADMAP.md`.

## Requirements

**R1.** Document the notes feature in the README's existing voice — plain,
specific, explaining *how it works* rather than selling it. Match the tone of the
existing "Each verse's first span gets a small invisible block before it" line.

**R2.** A complete shortcut table, and say where each one works:

| Shortcut | Scope |
|---|---|
| `Alt+P` / `Alt+A` / `Alt+S` | bible.com reader |
| `Alt+N` save selection | bible.com reader |
| `Alt+B` toggle panel | bible.com reader |
| `Alt+Shift+N` open notes | anywhere (`chrome.commands`) |

Mention `chrome://extensions/shortcuts` for conflicts (T-029's R7).

**R3. A privacy and data section, stated plainly:**

- notes are stored **locally in this browser profile** and never sent anywhere
- the extension makes no network requests and has no analytics
- clearing browsing data or removing the extension **deletes them**
- export is how to keep a copy
- the permissions requested, and why each one

**Do not soften this.** It is the honest statement the backup feature depends on.

**R4.** Explain the permissions individually. `unlimitedStorage` and `sidePanel`
look alarming without a reason attached, and a reader who understands them trusts
the rest.

**R5.** Keep the existing disclaimer that BibleBoost is independent and not
affiliated with or endorsed by YouVersion or Life.Church.

**R6.** Document `node --test test/` for contributors, and point at
`work/README.md` for the task and understanding system.

**R7.** Fix the existing documentation errors tracked in EPIC-08 — the missing
`tools/package.ps1` reference and the wrong path in the icon render script's
header comment — or reflect reality if they are resolved differently.

**R8.** Screenshots of the panel and the notes page, in both themes. The feature
is visual and a wall of prose undersells it.

**R9.** If a store listing is prepared, its description must carry the same
honest data statement as R3. A listing that implies the notes are backed up
would be a misleading claim.

## Files

- `README.md`
- `work/README.md` — cross-link
- any store listing copy

## Reference

- `work/understandings/extension/05-mv3-constraints.md` — why each permission
- `work/requirements/EPIC-06-import-export/T-049-backup-ux.md` — the durability
  language
- `work/requirements/EPIC-08-maintenance/` — the documentation bugs

## Acceptance

- [ ] The notes feature is documented in the README's existing voice
- [ ] Every shortcut is listed with its scope
- [ ] `chrome://extensions/shortcuts` is mentioned
- [ ] The privacy section states local-only storage and that clearing data
      deletes notes, without softening
- [ ] Every permission is listed with a plain reason
- [ ] The YouVersion disclaimer is intact
- [ ] `node --test test/` is documented
- [ ] `work/` is cross-linked
- [ ] The stale references from EPIC-08 are corrected
- [ ] Screenshots in both themes
- [ ] Any store copy carries the same data statement

## Notes

R3 is the requirement that matters. A user who reads it will back up; a user who
reads a reassuring paraphrase will not, and will find out the hard way.
