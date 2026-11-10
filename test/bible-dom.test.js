/*
 * src/content/bible-dom.js — reading a reader URL, swapping its sides, and sharing BB with versions.js.
 *
 * bible-dom.js is a classic script, so it cannot be imported, and it is run through node:vm instead.
 * Only URL is handed in, because it is the one thing the code under test uses that a bare vm context
 * lacks. Nothing here stands in for the page: every function that needs a document is left uncalled,
 * and those stay manual checks (test/README.md).
 *
 * The URL shapes are the ones written down in 01-urls-and-routing.md and 03-columns-and-versions.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const BIBLE_DOM = source('src/content/bible-dom.js');
const VERSIONS = source('src/shared/versions.js');

function load(...scripts) {
  const context = vm.createContext({ URL });
  for (const script of scripts) vm.runInContext(script, context);
  return vm.runInContext('BB', context);
}

const { parseUrl, swappedUrl } = load(BIBLE_DOM).dom;
const page = (path) => `https://www.bible.com${path}`;
const abbrOf = (path) => parseUrl(page(path)).abbr;

// ---------- parseUrl: the abbreviation ----------
test('parseUrl reads the abbreviation of a chapter URL', () => {
  assert.equal(abbrOf('/bible/339/EXO.13.TAOVBSI?parallel=114'), 'TAOVBSI');
});

test('parseUrl reads an abbreviation that contains digits', () => {
  assert.equal(abbrOf('/bible/100/JHN.1.NASB1995'), 'NASB1995');
});

// The trap in "the third segment": this one is fourth.
test('parseUrl reads the abbreviation of a verse URL', () => {
  assert.equal(abbrOf('/bible/111/JHN.3.16.NIV'), 'NIV');
});

// The form the verse menu's header link takes.
test('parseUrl reads the abbreviation past a list of verses', () => {
  assert.equal(abbrOf('/bible/339/EXO.13.1-2,4.TAOVBSI'), 'TAOVBSI');
});

test('parseUrl reads the abbreviation of a book intro', () => {
  assert.equal(abbrOf('/bible/111/JHN.INTRO1.NIV'), 'NIV');
});

test('parseUrl decodes a percent-encoded abbreviation', () => {
  assert.equal(abbrOf('/bible/48/EXO.13.CUNPSS-%E7%A5%9E'), 'CUNPSS-神');
});

// Not seen on the site. parseUrl's own pattern has always allowed a prefix before /bible/.
test('parseUrl reads the abbreviation under a locale prefix', () => {
  assert.equal(abbrOf('/ta/bible/339/EXO.13.TAOVBSI'), 'TAOVBSI');
});

// The URL the popup's Open button builds, which bible.com serves as it is.
test('parseUrl finds no abbreviation in a URL that has none', () => {
  assert.equal(abbrOf('/bible/111/JHN.1?parallel=114'), null);
  assert.equal(abbrOf('/bible/111/JHN.INTRO1'), null);
});

test('parseUrl does not mistake a verse number for an abbreviation', () => {
  assert.equal(abbrOf('/bible/111/JHN.3.16'), null);
  assert.equal(abbrOf('/bible/111/JHN.3.16-18'), null);
});

// Not seen on the site. align() calls parseUrl on every pass, so this must not become a throw.
test('parseUrl answers null for an abbreviation that cannot be decoded', () => {
  assert.equal(abbrOf('/bible/339/EXO.13.BAD%E7'), null);
});

// ---------- parseUrl: what it already did ----------
test('parseUrl still reports the id, the chapter and the parallel id', () => {
  const { id, ref, parallel } = parseUrl(page('/bible/339/EXO.13.TAOVBSI?parallel=114'));
  assert.deepEqual([id, ref, parallel], ['339', 'EXO.13', '114']);
});

test('parseUrl still returns null off the reader', () => {
  assert.equal(parseUrl(page('/moments')), null);
});

// ---------- swappedUrl ----------
// Written as paths and compared as absolute URLs, because the answer goes straight to location.assign.
const swap = (path, abbr) => swappedUrl(page(path), abbr);
const TAOVBSI_NKJV = '/bible/339/EXO.13.TAOVBSI?parallel=114';

test('swappedUrl trades the two versions and names the new primary', () => {
  assert.equal(swap(TAOVBSI_NKJV, 'NKJV'), page('/bible/114/EXO.13.NKJV?parallel=339'));
});

// The old abbreviation names the version that just left the path, so keeping it would call NKJV
// TAOVBSI. A path with none is served as it is (01-urls-and-routing.md, trap 4).
test('swappedUrl drops the old abbreviation when it has no new one', () => {
  assert.equal(swap(TAOVBSI_NKJV), page('/bible/114/EXO.13?parallel=339'));
});

// The URL the popup's Open button builds.
test('swappedUrl swaps a URL that has no abbreviation to begin with', () => {
  assert.equal(swap('/bible/111/JHN.1?parallel=114'), page('/bible/114/JHN.1?parallel=111'));
  assert.equal(swap('/bible/111/JHN.1?parallel=114', 'NKJV'), page('/bible/114/JHN.1.NKJV?parallel=111'));
});

test('swappedUrl keeps the verse of a verse URL', () => {
  assert.equal(swap('/bible/339/JHN.3.16.TAOVBSI?parallel=114', 'NKJV'), page('/bible/114/JHN.3.16.NKJV?parallel=339'));
});

// With no abbreviation on the slug, the last dot-part is a verse and has to survive.
test('swappedUrl does not mistake a verse number for the old abbreviation', () => {
  assert.equal(swap('/bible/339/JHN.3.16?parallel=114'), page('/bible/114/JHN.3.16?parallel=339'));
});

// The form the verse menu's header link takes.
test('swappedUrl keeps a list of verses', () => {
  assert.equal(swap('/bible/339/EXO.13.1-2,4.TAOVBSI?parallel=114', 'NKJV'), page('/bible/114/EXO.13.1-2,4.NKJV?parallel=339'));
});

test('swappedUrl percent-encodes the new abbreviation', () => {
  assert.equal(swap('/bible/339/EXO.13.TAOVBSI?parallel=48', 'CUNPSS-神'), page('/bible/48/EXO.13.CUNPSS-%E7%A5%9E?parallel=339'));
});

test('swappedUrl removes an old abbreviation that is percent-encoded', () => {
  assert.equal(swap('/bible/48/EXO.13.CUNPSS-%E7%A5%9E?parallel=339', 'TAOVBSI'), page('/bible/339/EXO.13.TAOVBSI?parallel=48'));
});

// parseUrl().abbr is null here, because this cannot be decoded, so anything stripping through it
// would leave the old abbreviation on the new path.
test('swappedUrl removes an old abbreviation that cannot be decoded', () => {
  assert.equal(swap('/bible/339/EXO.13.BAD%E7?parallel=114'), page('/bible/114/EXO.13?parallel=339'));
});

// resolveVersion answers with the numeric id when it knows nothing better, and EXO.13.114 would read
// as verse 114 of the chapter.
for (const abbr of ['114', '', '1-2,4', null, undefined]) {
  test(`swappedUrl treats ${JSON.stringify(abbr)} as no abbreviation`, () => {
    assert.equal(swap(TAOVBSI_NKJV, abbr), page('/bible/114/EXO.13?parallel=339'));
  });
}

// The other side of that guard: digits are only a problem when they are all there is.
test('swappedUrl writes an abbreviation that contains digits', () => {
  assert.equal(swap('/bible/339/JHN.1.TAOVBSI?parallel=100', 'NASB1995'), page('/bible/100/JHN.1.NASB1995?parallel=339'));
});

// The prefix is not seen on the site, as above. The parameter and the hash are.
test('swappedUrl keeps a path prefix, other parameters and the hash', () => {
  assert.equal(
    swap('/ta/bible/339/EXO.13.TAOVBSI?parallel=114&audio=1#v5', 'NKJV'),
    page('/ta/bible/114/EXO.13.NKJV?parallel=339&audio=1#v5'),
  );
});

test('swappedUrl comes back to the original when swapped twice', () => {
  assert.equal(swappedUrl(swap(TAOVBSI_NKJV, 'NKJV'), 'TAOVBSI'), page(TAOVBSI_NKJV));
});

// T-057 decides whether the dock has a button from exactly this answer.
for (const [label, path] of [
  ['off the reader', '/moments'],
  ['on a single version', '/bible/339/EXO.13.TAOVBSI'],
  ['when ?parallel= repeats the id', '/bible/339/EXO.13.TAOVBSI?parallel=339'],
  ['on a book intro', '/bible/339/JHN.INTRO1.TAOVBSI?parallel=114'],
]) {
  test(`swappedUrl has nothing to swap ${label}`, () => {
    assert.equal(swap(path, 'NKJV'), null);
  });
}

// ---------- One BB ----------
// The manifest fixes an order, and this proves nothing depends on it. versions.js writes to
// globalThis and bible-dom.js declares a var, and those have to turn out to be the same thing.
for (const [label, scripts] of [
  ['bible-dom.js first', [BIBLE_DOM, VERSIONS]],
  ['versions.js first', [VERSIONS, BIBLE_DOM]],
]) {
  test(`versions.js and bible-dom.js share one BB, ${label}`, () => {
    const BB = load(...scripts);
    assert.equal(typeof BB.dom.parseUrl, 'function');
    assert.equal(BB.VERSIONS.get('339').abbr, 'TAOVBSI');
  });
}
