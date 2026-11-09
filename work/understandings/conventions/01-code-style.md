# Code style

Confidence: **verified** — derived from the existing source, not invented.

Match the existing code. A reviewer should not be able to tell which files are
new.

## Formatting

| Thing | Rule |
|---|---|
| Indentation | 2 spaces, never tabs |
| Quotes | single; double only *inside* a string, e.g. `'div[class*="vid"]'` |
| Semicolons | always |
| Trailing commas | yes, in multiline literals |
| Line wrapping | not Prettier-style; compact one-liners like `if (!block) return null;` are idiomatic here |

## Naming

| Kind | Convention | Examples |
|---|---|---|
| functions, variables | camelCase | `parseUrl`, `columnEls`, `bandTop`, `levelRules` |
| constants | SCREAMING_CASE | `DEFAULTS`, `VISUAL` |
| regexes | `*_RE` | `REF_RE`, `VID_RE`, `BAND_STOP_RE` |
| DOM data attributes | `data-bb-*` | `data-bb-align`, `data-bb-v`, `data-bb-own` |
| CSS custom properties | `--bb-*` | `--bb-gap`, `--bb-sep-rise` |
| DOM ids / classes on the page | `bb-*` | `#bb-dock`, `.bb-sw` |

The `bb-` prefix on everything injected into bible.com is not decoration — it is
what keeps the extension from colliding with the host page.

## Structure

- Section banners: `// ---------- Alignment ----------`
- Small, mostly pure functions. DOM **reads** separated from DOM **writes**, with
  comments explicit about ordering when layout is involved.
- Module-level `let` for state (`settings`, `marked`, `markedCols`).
- Optional chaining, `??`, `replaceChildren` are all in use — modern syntax is
  fine.
- Defensive fallback when a Chrome API may be absent:
  `const store = (typeof chrome !== 'undefined' && chrome.storage...) || null;`

## Comments — the thing that makes this codebase what it is

Long prose block comments above each function explaining **why**, not what. They
cite measured values, specific verses, and bible.com quirks. Examples from the
source:

> bible.com tags each column with a vidNNN class, but inconsistently: the
> parallel column is "version vid59 iso6393eng" while the primary one is a hashed
> "cat7xG_vid111" with no "version" class at all. Match the vid token itself.

> Note it does NOT match on class name. bible.com's current build emits a plain
> "_s" with no digit, which is why the old /_s\d/ test never once fired on a live
> page.

**When you discover something about bible.com, the comment goes in the code AND
the finding goes in `work/understandings/`.** The comment explains this function;
the understanding file stops the next session from rediscovering it.

## Hard rules

1. **Build DOM with `createElement` + `textContent`. Never `innerHTML`.**
   Commit `c41bdd0` made this change deliberately. Even where every value is a
   literal today, `textContent` keeps it safe for free if a label later comes
   from storage or from the page — which, with user-authored notes, it now will.
2. **Never re-render or remove bible.com's own DOM.** The project's founding
   rule. Add, never replace.
3. **No dependencies, no build step.** See
   `../extension/05-mv3-constraints.md`.
4. **Compare before writing to storage.** The `remember()` pattern — write only
   when a value genuinely changed, and swallow `lastError`. `storage.sync` fails
   silently past ~120 writes/minute.
5. **Everything injected into the page carries `data-bb-own`.** See
   `../extension/04-observer-hazards.md`.

## Tests

`node --test` — Node has a built-in runner, so there is **no
package.json and no dependencies**. Cover pure logic only: ref parsing,
normalization, CSV quoting, migrations, search ranking. DOM and integration
behaviour is verified manually against live bible.com, per each task's acceptance
list.

### The command takes no path

Run it from the repository root exactly as `node --test`. The form this project
first documented, `node --test test/`, **does not run anything** on Node 21 and
later: it fails with `Cannot find module '…\test'`, because those versions read
each argument as a file or a glob pattern, not as a directory to search. Bare
`node --test` searches by itself and picks up every `test/*.test.js`. Naming one
file, `node --test test/router.test.js`, works too. Verified on Node 24.14.1
during T-002.

### Everything under `test/` is executed

Bare `node --test` runs every `.js` file under a directory named `test`, not only
the `*.test.js` ones. A helper left there runs as a test file of its own and is
counted in the total. Verified on Node 24.14.1 during T-007, with a probe file
that printed when it ran. Keep a helper in the test file that uses it, or outside
`test/`.

### Decomposed text is written with escapes

A decomposed Tamil fixture goes in the source as `\u` escapes, next to an
assertion that it differs from the composed form. Typed as a literal, an editor
that normalizes on save turns it into the composed form with no visible change,
and the test then compares a string with itself and passes.

### Node 22 or later

Two things set that floor, and neither can be fixed with a config file, because
there must not be one:

- **The tests are ES modules with no `package.json` to say so.** Node runs an
  `import` in a plain `.js` file only because it detects module syntax, which
  is on by default since Node 22.7 (from Node's changelog, not tested here).
  Older versions stop at `Cannot use import statement outside a module`.
- **`src/shared/schema.js` calls the global `crypto.randomUUID()`**, which the
  service worker has and Node only has globally since 19.
