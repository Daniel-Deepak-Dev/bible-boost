# CLAUDE.md

@AGENTS.md

---

The project's instructions live in [`AGENTS.md`](AGENTS.md), imported above so
they apply to every session here. Everything in that file is binding; this page
adds only what is specific to working in Claude Code.

## Stay on main

**Never create a git branch unless explicitly asked.** Commit to `main`.

**A worktree is allowed, but ask every time — auto mode does not count as a
yes.** Running with pre-approved permissions still means asking in the
conversation first, and an earlier yes covers only that worktree.

Both rules are restated here rather than left to the `@AGENTS.md` import,
because a general "branch before committing on the default branch" default would
otherwise win by accident. It does not apply to this repository.

## Before you start

Load the context the task needs, in this order:

1. [`work/requirements/README.md`](work/requirements/README.md) — pick a task
2. The task file itself, in full
3. **The understanding files its Reference section links to**

Step 3 is the one that matters. `work/understandings/` exists because this
project's bugs come from assuming how bible.com's DOM behaves, and several
plausible assumptions are documented there as wrong. Reading three short files
is cheaper than rediscovering why `/_s\d/` never matched anything.

## Keep plans in the task files

The tasks already carry Requirements, Scope and Acceptance. Work from those
rather than restating them as a fresh plan — and when the work reveals the task
was wrong, **edit the task file**, do not just do something different.

## Verification is manual, by design

There is no browser automation here. Most acceptance items mean loading the
unpacked extension and looking at a live bible.com page. When you cannot run
something, say so plainly rather than ticking the box — an unverified checkbox is
worse than an empty one, because the next session will trust it.

The standing regression check after any change to page-side code:

> Open `/bible/339/EXO.13.TAOVBSI?parallel=114` — verses align, separators draw,
> `Alt+P` / `Alt+A` / `Alt+S` work, and changing the reader's "Aa" size re-aligns.

## Leave the knowledge behind

Finishing a task includes updating `work/understandings/` with anything learned
that a future session would otherwise have to work out again — a real selector, a
surprising behaviour, a wrong assumption corrected. If a file there turns out to
be wrong, fix it in the same change; a stale understanding is worse than none,
because it will be trusted.

## Do not add tooling

No `package.json`, no bundler, no formatter config, no dependency — including
"just for tests" or "just for the build". Tests run on Node's built-in runner
precisely so this stays true. If a change appears to need tooling, that is a
signal the approach is wrong, not that the rule should bend.
