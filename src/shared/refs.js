/*
 * BibleBoost — verse references
 * Reading a data-usfm key, putting verses in canonical order, captioning a set of them, and the table
 * of versions the popup offers.
 * work/understandings/bible-com/02-verse-dom.md documents the key this file parses.
 *
 * The key is the only thing here that is stable across versions and languages. Localized book names
 * exist only in bible.com's own DOM (07-i18n-and-scripts.md), so nothing in this file produces or
 * parses one: a caption built here is in USFM, and T-012's displayRef is what a reader sees.
 *
 * Nothing in here may touch chrome.* or the DOM. The file has to load in plain Node so that
 * `node --test` can cover it (T-007 R3).
 */

import './versions.js';

// ---------- Versions ----------
// Defined in versions.js because a content script has to read it too, and a content script cannot
// import this file. Re-exported here so that a module gets it the ordinary way and only one file has
// to know about globalThis.
export const VERSIONS = globalThis.BB.VERSIONS;

// ---------- Books ----------
// The canonical order, and the only source of it (T-028 R2). Sorting by code instead puts 1CO before
// ACT and every numbered book ahead of Genesis.
export const BOOKS = Object.freeze([
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH',
  '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK',
  'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH',
  '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD',
  'REV',
]);

const BOOK_INDEX = new Map(BOOKS.map((book, i) => [book, i]));

// ---------- Parsing ----------
// Digits only after the book, which is what rejects a book intro such as JHN.INTRO1: it has no
// chapter, and bible.com renders no parallel column for one (01-urls-and-routing.md, trap 1).
const USFM_RE = /^([A-Z0-9]{3})\.(\d+)\.(\d+)$/;

// Checks the shape and not the book. schema.js stores any three-character book, so a key it accepted
// has to stay readable here, and USFM defines codes outside the 66, such as TOB.
//
// bible.com can write a combined verse as "JHN.1.1+JHN.1.2" in data-usfm, and the rule everywhere is
// to take the part before the plus (02-verse-dom.md).
//
// Returns null rather than throwing, the same as BB.dom.parseUrl for a chapterless page. A bad ref is
// an ordinary event: T-047 has to import the note without verses and report it, not stop the import.
export function parseUsfm(raw) {
  if (typeof raw !== 'string') return null;
  const match = USFM_RE.exec(raw.split('+')[0]);
  if (!match) return null;
  const [usfm, book, chapter, verse] = match;
  return { usfm, book, chapter: Number(chapter), verse: Number(verse) };
}

// ---------- Ordering ----------
// Book index, then chapter, then verse, and all three as numbers: EXO.13.10 comes after EXO.13.2,
// which plain string order gets wrong. Usable directly as an Array.prototype.sort comparator.
//
// A book outside the 66 sorts after Revelation. There is no table saying where TOB belongs, and after
// the canon is the one position that cannot disturb the order of the books that are in it.
//
// The book code is compared before the chapter because every unknown book shares one rank. Without
// that step TOB.1.1, JDT.1.1 and TOB.2.1 would alternate, mixing two books together.
//
// What cannot be parsed goes last, where T-028 R2 puts a note with no verses. It gets an answer
// rather than an exception because this runs inside sort, on keys that can come from imported files.
const bookRank = (book) => BOOK_INDEX.get(book) ?? BOOKS.length;

export function compareUsfm(a, b) {
  const x = parseUsfm(a);
  const y = parseUsfm(b);
  if (!x || !y) return (x ? 0 : 1) - (y ? 0 : 1);
  return bookRank(x.book) - bookRank(y.book)
    || (x.book < y.book ? -1 : x.book > y.book ? 1 : 0)
    || x.chapter - y.chapter
    || x.verse - y.verse;
}

// ---------- Captions ----------
// Sorted first, so the caption does not depend on the order verses were selected in (T-016 R4), and
// grouped by chapter, because a selection can cross a chapter boundary (T-016 R3).
//
// `verse <= last.to + 1` is what collapses a run, and the <= is what absorbs a repeated verse: after
// sorting, a duplicate equals last.to and extends the run by nothing.
//
// What cannot be parsed is dropped. This makes a caption and has no way to report anything, and a
// label with one verse missing is better than a list row that throws.
export function formatRange(usfms) {
  const refs = usfms.map((raw) => parseUsfm(raw)).filter(Boolean).sort((a, b) => compareUsfm(a.usfm, b.usfm));
  const chapters = new Map();
  for (const { book, chapter, verse } of refs) {
    const key = `${book}.${chapter}`;
    if (!chapters.has(key)) chapters.set(key, []);
    const runs = chapters.get(key);
    const last = runs.at(-1);
    if (last && verse <= last.to + 1) last.to = verse;
    else runs.push({ from: verse, to: verse });
  }
  const spell = ({ from, to }) => (from === to ? `${from}` : `${from}-${to}`);
  return [...chapters].map(([key, runs]) => `${key}.${runs.map(spell).join(',')}`).join('; ');
}

// ---------- Captions in the page's own words ----------
// What a list row calls a note (T-021 R4): "யாத்திராகமம் 13:2-4" when the note kept bible.com's
// references, and formatRange's "EXO.13.2-4" when it did not. displayRef is stored per verse
// (02-storage-model.md), so the first verse's alone would call a three-verse note "…13:2", and a
// note's caption has to be built from all of them.
//
// This is captionOf in save-popover.js, which captions a selection the same way before it is saved, and
// it is written out again there only because a classic script cannot import this file.
// test/save-popover.test.js runs both over the same verses, so if they drift a test fails. The one
// difference is that this one meets stored notes, which can come from an import and so in principle
// from two books at once, where the popover only ever sees one page: so it orders with compareUsfm and
// keeps chapters of different books apart, where the copy needs neither.
//
// Only the first verse of each chapter gives up its displayRef, and that is cut, not read: the verse's
// own number comes off the end, and what is left is the heading, in whatever script or punctuation the
// version writes it. Every other number comes from the key, so nothing here parses a localized name
// (07-i18n-and-scripts.md). The heading is used only if every verse's reference ends in that verse's own
// number, because a combined verse ("Romans 1:3-4" on ROM.1.3), a verse saved with Numbers and Titles
// switched off (no reference at all, B-011) or a version that does not write ASCII digits would put the
// cut in the wrong place. Any one of those sends the whole caption to the canonical form. The
// lookbehind keeps "1-11" on JHN.1.1 from passing as ending in 1.
//
// A lone verse is the exception, and keeps its reference whole: nothing has to be added to it, and
// "Romans 1:3-4" is right as it stands. A note with no verses captions as nothing, and the row decides
// what to show instead.
export function captionOf(verses) {
  if (!Array.isArray(verses) || !verses.length) return '';
  if (verses.length === 1) return verses[0].displayRef || verses[0].usfm || '';

  const rows = verses.flatMap(({ usfm, displayRef: ref }) => {
    const key = parseUsfm(usfm);
    return key ? [{ ...key, ref }] : [];
  }).sort((a, b) => compareUsfm(a.usfm, b.usfm));

  const localized = rows.every(({ ref, verse }) => ref && new RegExp(`(?<!\\d)${verse}$`).test(ref));
  const chapters = new Map();
  for (const { book, chapter, verse, ref } of rows) {
    const key = `${book}.${chapter}`;
    if (!chapters.has(key)) {
      chapters.set(key, { heading: localized ? ref.slice(0, -String(verse).length) : `${key}.`, runs: [] });
    }
    const { runs } = chapters.get(key);
    const last = runs.at(-1);
    if (last && verse <= last.to + 1) last.to = verse;
    else runs.push({ from: verse, to: verse });
  }
  const spell = ({ from, to }) => (from === to ? `${from}` : `${from}-${to}`);
  return [...chapters.values()].map(({ heading, runs }) => heading + runs.map(spell).join(',')).join('; ');
}
