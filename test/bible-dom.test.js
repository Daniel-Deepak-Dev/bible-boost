/*
 * src/content/bible-dom.js — reading a reader URL, and sharing BB with versions.js.
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

const { parseUrl } = load(BIBLE_DOM).dom;
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
