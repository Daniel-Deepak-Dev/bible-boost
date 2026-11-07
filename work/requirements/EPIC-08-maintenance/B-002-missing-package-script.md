# B-002 — tools/package.ps1 referenced but absent

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Pre-existing debt |
| Blocks release | **Yes** |
| Size | S |
| Risk | Low |

## The problem

`icons/ARTWORK.md` line 5 states that `tools/package.ps1` refuses to build a
store zip while the artwork status says INTERIM.

**There is no `tools/` directory and no such script.** The guard described in the
documentation cannot fire, because the thing that would enforce it does not
exist.

Related loose ends pointing the same way:

- `README.md` line 6 says "Unzip", implying a distributed archive
- `.gitignore` lists `*.zip` and `/dist`, anticipating build output
- nothing in the repo produces either

So the project is documented as having a packaging step it has never had.

## Why it matters

Two reasons, and the second is the real one:

1. There is no reproducible way to produce a store-ready zip. Doing it by hand
   risks shipping the wrong files — most seriously `other-resource/`, which
   contains YouVersion-derived artwork explicitly marked DO NOT SHIP.
2. **The INTERIM guard from [B-001](B-001-artwork-interim.md) is imaginary.**
   The documentation claims a safety mechanism that does not exist, which is
   worse than having no mechanism, because it has been relied on.

## Scope

**In:** a packaging script that produces a clean zip and enforces the guard.

**Out:** CI, publishing automation, versioning policy.

## Requirements

**R1.** `tools/package.ps1` produces `dist/bibleboost-<version>.zip`, taking the
version from `manifest.json` rather than an argument.

**R2. Allowlist, never denylist.** Include only what ships: `manifest.json`,
`content.js`, `content.css`, `popup.*`, `background.js`, `src/`, `icons/icon*.png`,
`README.md`. Everything else is excluded by default.

A denylist will eventually miss something, and the thing it misses is
`other-resource/`.

**R3. Hard-fail** if `icons/ARTWORK.md` still says `STATUS: INTERIM`, with a
message naming B-001. This is the guard the documentation already claims exists.

**R4. Hard-fail** if any path under `other-resource/` would be included, as a
second line of defence independent of R2.

**R5.** Exclude `work/`, `test/`, `icons/v1/`, `icons/v2-svg/`, `icons/*.ps1`,
`ARTWORK.md`, `.git*`, `ROADMAP.md`, `AGENTS.md`, `CLAUDE.md`.

**R6.** Print a manifest of what was included and the total size, so a
mistake is visible without unzipping.

**R7.** PowerShell, no dependencies — consistent with the existing icon scripts
and the project's tool-free character.

**R8.** Fail if `manifest.json` does not parse, or if a referenced icon file is
missing.

## Acceptance

- [ ] `tools/package.ps1` produces a zip named for the manifest version
- [ ] The zip loads as an unpacked extension and works
- [ ] It contains **nothing** from `other-resource/`, `work/`, `test/` or
      `icons/v1/`
- [ ] It refuses to build while `ARTWORK.md` says INTERIM, naming B-001
- [ ] It refuses if an `other-resource/` path would somehow be included
- [ ] It refuses on a malformed manifest or a missing icon
- [ ] It prints the file list and total size
- [ ] `ARTWORK.md`'s claim about the script is now true
- [ ] `README.md`'s install instructions match what actually ships

## Notes

R2 and R4 overlap deliberately. The one file that must never ship is the one a
denylist would miss, so it is worth guarding twice.
