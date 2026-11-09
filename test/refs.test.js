/*
 * src/shared/refs.js — reading a data-usfm key, ordering verses, and captioning a set of them.
 *
 * The book codes are chosen to be awkward. 1CO and 3JN start with a digit, and 1CO sorts before ACT
 * in plain string order, which is the mistake canonical ordering exists to prevent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOKS, VERSIONS, parseUsfm, compareUsfm, formatRange } from '../src/shared/refs.js';

// ---------- parseUsfm ----------
test('parseUsfm splits a key into book, chapter and verse', () => {
  assert.deepEqual(parseUsfm('EXO.13.2'), { usfm: 'EXO.13.2', book: 'EXO', chapter: 13, verse: 2 });
});

test('parseUsfm accepts book codes that start with a digit', () => {
  assert.deepEqual(parseUsfm('1CO.1.1'), { usfm: '1CO.1.1', book: '1CO', chapter: 1, verse: 1 });
  assert.deepEqual(parseUsfm('3JN.1.1'), { usfm: '3JN.1.1', book: '3JN', chapter: 1, verse: 1 });
});

// 02-verse-dom.md: the attribute can read JHN.1.1+JHN.1.2, and the rule is the part before the plus.
test('parseUsfm reads a combined verse as the key before the plus', () => {
  assert.deepEqual(parseUsfm('JHN.1.1+JHN.1.2'), { usfm: 'JHN.1.1', book: 'JHN', chapter: 1, verse: 1 });
});

// 01-urls-and-routing.md, trap 1: a book intro has no chapter, so it must not parse as a verse.
test('parseUsfm rejects a book intro', () => {
  assert.equal(parseUsfm('JHN.INTRO1'), null);
  assert.equal(parseUsfm('JHN.INTRO1+JHN.1.1'), null);
});

test('parseUsfm rejects anything that is not exactly one verse', () => {
  for (const raw of ['EXO.13', 'EXO.13.2-4', 'EXO.13.2.1', 'exo.13.2', 'EX.13.2', 'EXOD.13.2', ' EXO.13.2', '']) {
    assert.equal(parseUsfm(raw), null, raw);
  }
});

test('parseUsfm returns null for anything that is not a string', () => {
  for (const raw of [null, undefined, 42, {}, []]) assert.equal(parseUsfm(raw), null);
});

// Shape only, on purpose. schema.js already stores any three-character book, so refusing one here
// would make a note it accepted unreadable. USFM defines codes outside the 66, such as TOB.
test('parseUsfm accepts a well-formed key for a book outside the 66', () => {
  assert.deepEqual(parseUsfm('TOB.1.1'), { usfm: 'TOB.1.1', book: 'TOB', chapter: 1, verse: 1 });
});

// ---------- BOOKS ----------
test('BOOKS is 66 distinct three-character codes', () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(new Set(BOOKS).size, 66);
  for (const book of BOOKS) assert.match(book, /^[A-Z0-9]{3}$/);
});

test('BOOKS puts each testament where it belongs', () => {
  assert.equal(BOOKS[0], 'GEN');
  assert.equal(BOOKS[38], 'MAL');
  assert.equal(BOOKS[39], 'MAT');
  assert.equal(BOOKS[65], 'REV');
});

test('BOOKS cannot be changed by a caller', () => {
  assert.ok(Object.isFrozen(BOOKS));
  assert.throws(() => BOOKS.push('XXX'), TypeError);
});

// ---------- VERSIONS ----------
test('VERSIONS maps an id to its abbreviation', () => {
  assert.equal(VERSIONS.get('339').abbr, 'TAOVBSI');
  assert.equal(VERSIONS.get('114').abbr, 'NKJV');
  assert.equal(VERSIONS.get('100').abbr, 'NASB1995');
});

// The order is the popup's, and it is why this is a Map. An object keyed by these ids would visit
// them in ascending numeric order and put KJV first.
test('VERSIONS keeps the order the popup lists them in', () => {
  assert.deepEqual([...VERSIONS.keys()], ['114', '1', '111', '59', '100', '116', '339']);
});

test('VERSIONS carries the labels the popup has always shown', () => {
  assert.deepEqual([...VERSIONS.values()].map(({ name }) => name), [
    'NKJV — New King James',
    'KJV — King James',
    'NIV',
    'ESV',
    'NASB1995',
    'NLT',
    'TAOVBSI — Tamil O.V. (BSI)',
  ]);
});

// T-011 R6: other code trusts this table, so what a page reveals must not be written into it.
test('VERSIONS entries cannot be changed by a caller', () => {
  for (const entry of VERSIONS.values()) assert.ok(Object.isFrozen(entry));
  assert.throws(() => { VERSIONS.get('114').abbr = 'X'; }, TypeError);
});

// ---------- compareUsfm ----------
const sorted = (...keys) => [...keys].sort(compareUsfm);

// The acceptance case from T-016 and T-028: as plain strings, 1CO comes before ACT.
test('compareUsfm orders books canonically, not alphabetically', () => {
  assert.deepEqual(sorted('1CO.1.1', 'ACT.1.1'), ['ACT.1.1', '1CO.1.1']);
  assert.deepEqual(sorted('EXO.1.1', 'GEN.1.1'), ['GEN.1.1', 'EXO.1.1']);
  assert.deepEqual(sorted('REV.1.1', 'MAT.1.1', 'MAL.1.1'), ['MAL.1.1', 'MAT.1.1', 'REV.1.1']);
});

test('compareUsfm orders chapters and verses as numbers', () => {
  assert.deepEqual(sorted('EXO.13.10', 'EXO.13.2'), ['EXO.13.2', 'EXO.13.10']);
  assert.deepEqual(sorted('EXO.13.1', 'EXO.9.1'), ['EXO.9.1', 'EXO.13.1']);
});

// === rather than assert.equal, because a strict assert treats -0 and 0 as different numbers and
// either one is a correct answer from a comparator.
test('compareUsfm calls a verse equal to itself, combined key included', () => {
  assert.ok(compareUsfm('EXO.13.2', 'EXO.13.2') === 0);
  assert.ok(compareUsfm('JHN.1.1+JHN.1.2', 'JHN.1.1') === 0);
});

test('compareUsfm puts a book outside the 66 after Revelation', () => {
  assert.deepEqual(sorted('TOB.1.1', 'REV.22.21', 'GEN.1.1'), ['GEN.1.1', 'REV.22.21', 'TOB.1.1']);
});

test('compareUsfm puts what it cannot parse last, even after a book outside the 66', () => {
  assert.deepEqual(sorted('JHN.INTRO1', 'TOB.1.1', 'GEN.1.1'), ['GEN.1.1', 'TOB.1.1', 'JHN.INTRO1']);
});

// If every unknown book got the same rank and chapters were compared next, Tobit 1 and Judith 1
// would alternate.
test('compareUsfm never interleaves the verses of two books outside the 66', () => {
  const out = sorted('TOB.2.1', 'JDT.1.1', 'TOB.1.1', 'JDT.2.1');
  const changes = out.filter((key, i) => i > 0 && key.slice(0, 3) !== out[i - 1].slice(0, 3));
  assert.equal(changes.length, 1, out.join(' '));
  assert.deepEqual(out.filter((key) => key.startsWith('TOB')), ['TOB.1.1', 'TOB.2.1']);
  assert.deepEqual(out.filter((key) => key.startsWith('JDT')), ['JDT.1.1', 'JDT.2.1']);
});

// Array.prototype.sort gives a wrong order without any error when a comparator disagrees with
// itself, or returns NaN. Bad input reaches this from imported files, so it has to stay consistent.
test('compareUsfm gives a consistent number for input it cannot parse', () => {
  const inputs = ['EXO.1.1', 'TOB.1.1', 'JHN.INTRO1', '', null, undefined];
  for (const a of inputs) {
    for (const b of inputs) {
      const there = compareUsfm(a, b);
      assert.ok(Number.isFinite(there), `${a} vs ${b}`);
      assert.equal(Math.sign(there) + Math.sign(compareUsfm(b, a)), 0, `${a} vs ${b}`);
    }
  }
});

// ---------- formatRange ----------
test('formatRange collapses a contiguous run', () => {
  assert.equal(formatRange(['EXO.13.2', 'EXO.13.3', 'EXO.13.4']), 'EXO.13.2-4');
});

test('formatRange joins a gap with a comma', () => {
  assert.equal(formatRange(['EXO.13.2', 'EXO.13.4']), 'EXO.13.2,4');
});

test('formatRange separates chapters with a semicolon', () => {
  assert.equal(formatRange(['EXO.13.2', 'EXO.13.3', 'EXO.14.1']), 'EXO.13.2-3; EXO.14.1');
});

test('formatRange leaves a single verse alone', () => {
  assert.equal(formatRange(['EXO.13.2']), 'EXO.13.2');
});

test('formatRange mixes runs and gaps within a chapter', () => {
  assert.equal(formatRange(['EXO.13.2', 'EXO.13.3', 'EXO.13.4', 'EXO.13.6', 'EXO.13.8', 'EXO.13.9']), 'EXO.13.2-4,6,8-9');
});

// 9, 10, 11 only form a run if they are compared as numbers.
test('formatRange collapses across a change in digit count', () => {
  assert.equal(formatRange(['EXO.13.10', 'EXO.13.9', 'EXO.13.11']), 'EXO.13.9-11');
});

test('formatRange sorts verses given out of order', () => {
  assert.equal(formatRange(['EXO.13.4', 'EXO.13.2', 'EXO.13.3']), 'EXO.13.2-4');
});

test('formatRange orders books canonically', () => {
  assert.equal(formatRange(['1CO.1.1', 'ACT.1.1']), 'ACT.1.1; 1CO.1.1');
});

test('formatRange counts a repeated verse once', () => {
  assert.equal(formatRange(['EXO.13.2', 'EXO.13.2', 'EXO.13.3']), 'EXO.13.2-3');
});

test('formatRange reads a combined key as its first verse', () => {
  assert.equal(formatRange(['JHN.1.1+JHN.1.2', 'JHN.1.2']), 'JHN.1.1-2');
});

test('formatRange drops what it cannot parse', () => {
  assert.equal(formatRange(['EXO.13.2', 'JHN.INTRO1', null, 'EXO.13.3']), 'EXO.13.2-3');
});

test('formatRange of nothing is an empty string', () => {
  assert.equal(formatRange([]), '');
  assert.equal(formatRange(['JHN.INTRO1']), '');
});

test('formatRange does not reorder the array it was given', () => {
  const given = ['EXO.13.4', 'EXO.13.2'];
  formatRange(given);
  assert.deepEqual(given, ['EXO.13.4', 'EXO.13.2']);
});
