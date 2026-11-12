/*
 * src/ui/app/scope.js — which notes the side panel lists (T-023).
 *
 * The rules only. The control is DOM, and stays a manual check (test/README.md). scope.js touches the
 * DOM only inside createScopeControl, so importing it in Node is itself a check that it stays that way.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_HINT, bookName, bookOf, chapterName, cleanLabel, cleanRef, cleanScope, effectiveScope, emptyText,
  filterFor, inFilter, sameFilter, shortCount,
} from '../src/ui/app/scope.js';

// ---------- What the host sends ----------
// A ref arrives by postMessage, where the page's own scripts can post as well, so only a chapter passes.
test('a ref must be a chapter, or it is null', () => {
  assert.equal(cleanRef('EXO.13'), 'EXO.13');
  assert.equal(cleanRef('1CO.13'), '1CO.13');
  for (const bad of [null, undefined, 13, 'EXO', 'EXO.13.2', 'JHN.INTRO1', 'exo.13', ' EXO.13', 'EXO.13\n']) {
    assert.equal(cleanRef(bad), null, String(bad));
  }
});

test('an unknown scope is the default, the chapter', () => {
  assert.equal(cleanScope('book'), 'book');
  assert.equal(cleanScope('all'), 'all');
  assert.equal(cleanScope(undefined), 'chapter');
  assert.equal(cleanScope('constructor'), 'chapter');
});

test('a label is trimmed text, capped, or null', () => {
  assert.equal(cleanLabel('  யாத்திராகமம் 13 '), 'யாத்திராகமம் 13');
  assert.equal(cleanLabel(''), null);
  assert.equal(cleanLabel('   '), null);
  assert.equal(cleanLabel({}), null);
  assert.equal(cleanLabel('x'.repeat(500)).length, 80);
});

// ---------- R1, R8, R9 ----------
test('each scope asks the worker for its own filter', () => {
  assert.deepEqual(filterFor('chapter', 'EXO.13'), { chapter: 'EXO.13' });
  assert.deepEqual(filterFor('book', 'EXO.13'), { book: 'EXO' });
  assert.deepEqual(filterFor('all', 'EXO.13'), {});
  assert.equal(bookOf('1CO.13'), '1CO');
});

test('a page with no chapter shows All whatever was chosen, and keeps the choice', () => {
  assert.equal(effectiveScope('chapter', null), 'all');
  assert.equal(effectiveScope('book', null), 'all');
  assert.deepEqual(filterFor('chapter', null), {});
  assert.deepEqual(filterFor('book', null), {});
  assert.equal(effectiveScope('chapter', 'EXO.1'), 'chapter');
});

// R5: a move inside one book leaves book scope's list alone, and any move changes the chapter's.
test('the list changes only when the filter does', () => {
  assert.equal(sameFilter(filterFor('book', 'EXO.13'), filterFor('book', 'EXO.14')), true);
  assert.equal(sameFilter(filterFor('book', 'EXO.40'), filterFor('book', 'LEV.1')), false);
  assert.equal(sameFilter(filterFor('chapter', 'EXO.13'), filterFor('chapter', 'EXO.14')), false);
  assert.equal(sameFilter(filterFor('all', 'EXO.13'), filterFor('chapter', null)), true);
});

// The same test noteMatches makes in the worker, with the trailing dot that keeps EXO.1 out of EXO.13.
test('a note is in a chapter or a book by its verse keys', () => {
  const note = { verseKeys: ['EXO.13.2', 'EXO.13.3'] };
  assert.equal(inFilter(note, { chapter: 'EXO.13' }), true);
  assert.equal(inFilter(note, { chapter: 'EXO.1' }), false);
  assert.equal(inFilter(note, { book: 'EXO' }), true);
  assert.equal(inFilter(note, { book: 'EZK' }), false);
  assert.equal(inFilter(note, {}), true);
});

// A note written in the panel has no verse (T-022 R4), and saving it in chapter scope takes it off the
// list, which the panel says in a toast.
test('a note with no verse is in no chapter and no book, only All', () => {
  const note = { verseKeys: [] };
  assert.equal(inFilter(note, { chapter: 'EXO.13' }), false);
  assert.equal(inFilter(note, { book: 'EXO' }), false);
  assert.equal(inFilter(note, {}), true);
  assert.equal(inFilter({}, { chapter: 'EXO.13' }), false);
});

// ---------- Names ----------
test('the chapter is named by the page heading, or by its USFM', () => {
  assert.equal(chapterName('EXO.13', 'யாத்திராகமம் 13'), 'யாத்திராகமம் 13');
  assert.equal(chapterName('EXO.13', null), 'EXO 13');
  assert.equal(chapterName(null, null), '');
});

test('the book is the heading without its chapter number, in any script', () => {
  assert.equal(bookName('EXO.13', 'யாத்திராகமம் 13'), 'யாத்திராகமம்');
  assert.equal(bookName('EXO.13', 'Exodus 13'), 'Exodus');
  assert.equal(bookName('1CO.13', '1 Corinthians 13'), '1 Corinthians');
  assert.equal(bookName('EXO.13', null), 'EXO');
});

// ---------- R3, the empty list ----------
test('an empty chapter says where the notes are instead', () => {
  const label = 'Exodus 13';
  assert.equal(emptyText('chapter', 'EXO.13', label, { chapter: 0, book: 12, all: 40 }), 'No notes on Exodus 13 yet. Exodus has 12 notes.');
  assert.equal(emptyText('chapter', 'EXO.13', label, { chapter: 0, book: 1, all: 1 }), 'No notes on Exodus 13 yet. Exodus has 1 note.');
  assert.equal(emptyText('chapter', 'EXO.13', label, { chapter: 0, book: 0, all: 40 }), 'No notes on Exodus 13 yet. 40 notes in other books.');
});

test('with no notes anywhere, the empty chapter says how to save one', () => {
  assert.equal(emptyText('chapter', 'EXO.13', null, { chapter: 0, book: 0, all: 0 }), `No notes on EXO 13 yet. ${SAVE_HINT}`);
  assert.equal(emptyText('book', 'EXO.13', null, { chapter: 0, book: 0, all: 0 }), `No notes in EXO yet. ${SAVE_HINT}`);
});

test('before the counts arrive, an empty chapter only says it is empty', () => {
  assert.equal(emptyText('chapter', 'EXO.13', 'Exodus 13'), 'No notes on Exodus 13 yet.');
  assert.equal(emptyText('book', 'EXO.13', 'Exodus 13', { chapter: null, book: null, all: null }), 'No notes in Exodus yet.');
});

test('an empty book points at the other books', () => {
  assert.equal(emptyText('book', 'EXO.13', 'Exodus 13', { chapter: 0, book: 0, all: 3 }), 'No notes in Exodus yet. 3 notes in other books.');
});

test('All keeps the list\'s own words, and so does a page with no chapter', () => {
  assert.equal(emptyText('all', 'EXO.13', 'Exodus 13', { all: 0 }), null);
  assert.equal(emptyText('chapter', null, null, { all: 0 }), null);
});

// ---------- The counts on the control ----------
test('a count is compact past a thousand, and blank when unknown', () => {
  assert.equal(shortCount(0), '0');
  assert.equal(shortCount(999), '999');
  assert.equal(shortCount(1234), '1.2K');
  assert.equal(shortCount(null), '');
  assert.equal(shortCount(-1), '');
});
