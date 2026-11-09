# Tests

```bash
node --test
```

Run it from the repository root with no path, on Node 22 or later. There is no
install step, because there is nothing to install: no `package.json`, no
dependencies, no config file. If a test seems to need one, the test is wrong.

## What belongs here

**Pure logic** that loads in plain Node: verse references, text normalization,
validation, migrations, CSV, search ranking. Modules under `src/shared/` have to
stay free of `chrome.*` and the DOM for this to work, so importing one here is
itself a test of that rule.

## What does not

**Anything that needs a browser**: the DOM, content scripts, alignment,
separators, keyboard shortcuts, or behaviour on a live bible.com page. Those are
checked by hand against each task's Acceptance list. Do not add a browser, a DOM
emulator or a stubbed `document` to move that line, because a test that passes
against a stand-in for bible.com proves nothing about bible.com.

## Writing a test

- Name it `<module>.test.js`, and use `node:test` and `node:assert/strict`.
- **Every `.js` file under `test/` is executed**, not only the `*.test.js` ones. A
  helper left here runs as a test of its own and is counted in the total. Keep it
  in the test file that uses it, or outside this folder.
- Text handling needs **real Tamil**, not transliteration, which passes and
  proves nothing.
- Write a decomposed Tamil string as `\u` escapes and assert that it differs from
  the composed form. An editor that normalizes on save would otherwise turn it
  into the composed form, and the test would compare a string with itself.
