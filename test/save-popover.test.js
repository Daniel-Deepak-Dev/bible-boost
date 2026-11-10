/*
 * src/content/save-popover.js — the draft it assembles, checked against the worker's real validator.
 *
 * The content script sends raw drafts and the worker refuses what it cannot store (architecture rule
 * 2), so the two only meet at runtime. A field named differently on each side would show up as a save
 * that fails on a live page. This runs the page side's output through cleanNoteDraft instead.
 *
 * save-popover.js is a classic script, so it is run through node:vm, with BB.dom and BB.capture standing
 * in for the page. Only the reading of verses is covered: the popover itself is DOM, and stays a manual
 * check (test/README.md).
 *
 * Every draft goes through wire() first, because that is what chrome.runtime.sendMessage does to it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { cleanNoteDraft } from '../src/shared/schema.js';

const SOURCE = readFileSync(new URL('../src/content/save-popover.js', import.meta.url), 'utf8');
const VID_RE = /(?:^|[\s_])vid(\d+)(?:\s|$)/;

const wire = (value) => JSON.parse(JSON.stringify(value));

const column = (vid) => ({ getAttribute: () => `version vid${vid}` });
const COLUMNS = [column('339'), column('114')];
const vidOf = (col) => col.getAttribute('class').match(VID_RE)[1];

const tamil = { versionId: '339', abbr: 'TAOVBSI', lang: 'tam', text: 'தமிழ்' };
const english = { versionId: '114', abbr: 'NKJV', lang: 'eng', text: 'Consecrate to Me' };

// pairs: usfm -> what versePair answers. refs: usfm -> { vid: caption }, for the columns that have one.
// asked collects which column each displayRef call went to.
function load(pairs, refs = {}) {
  const asked = [];
  const BB = {
    dom: { VID_RE, columnEls: () => COLUMNS, firstSpans: () => new Map() },
    capture: {
      getSelection: () => null,
      versePair: (usfm) => pairs[usfm],
      displayRef: (usfm, col) => {
        asked.push(vidOf(col));
        return refs[usfm]?.[vidOf(col)] ?? null;
      },
    },
  };
  const context = vm.createContext({ BB });
  vm.runInContext(SOURCE, context);
  const { readVerses } = context.BB.savePopover.debug;
  return { asked, verses: (usfms) => wire(readVerses({ usfms })) };
}

const stored = (verses) => cleanNoteDraft({ source: 'menu', verses }).fields.verses;

test('a verse with both sides is stored with both versions and its reference', () => {
  const { verses } = load(
    { 'EXO.13.2': { primary: tamil, parallel: english } },
    { 'EXO.13.2': { 339: 'யாத்திராகமம் 13:2' } },
  );
  const [verse] = stored(verses(['EXO.13.2']));
  assert.equal(verse.usfm, 'EXO.13.2');
  assert.equal(verse.displayRef, 'யாத்திராகமம் 13:2');
  assert.deepEqual([verse.primary.abbr, verse.primary.lang, verse.primary.text], ['TAOVBSI', 'tam', 'தமிழ்']);
  assert.deepEqual([verse.parallel.abbr, verse.parallel.lang, verse.parallel.text], ['NKJV', 'eng', 'Consecrate to Me']);
});

test('the reference comes from the primary column when there is a primary side', () => {
  const { asked, verses } = load({ 'EXO.13.2': { primary: tamil, parallel: english } });
  verses(['EXO.13.2']);
  assert.deepEqual(asked, ['339']);
});

test('a verse on a single-version page has no parallel side', () => {
  const { verses } = load({ 'EXO.13.2': { primary: tamil, parallel: null } });
  assert.equal(stored(verses(['EXO.13.2']))[0].parallel, null);
});

// NIV's column carries no language token, so this is an ordinary save and must not be refused (T-011).
test('a version whose language is unknown still saves', () => {
  const { verses } = load({ 'MAT.17.1': { primary: { ...english, lang: null }, parallel: null } });
  assert.equal(stored(verses(['MAT.17.1']))[0].primary.lang, '');
});

test('a verse the page cannot caption still saves, with an empty reference', () => {
  const { verses } = load({ 'EXO.13.2': { primary: tamil, parallel: english } });
  assert.equal(stored(verses(['EXO.13.2']))[0].displayRef, '');
});

// A verse that is really there and reads blank, as NIV's Matthew 17:21 does, is not a missing one.
test('a blank verse still saves', () => {
  const { verses } = load({ 'MAT.17.21': { primary: { ...english, text: '' }, parallel: null } });
  assert.equal(stored(verses(['MAT.17.21']))[0].primary.text, '');
});

// CEV writes Romans 1:3-4 as one element, so its column has no ROM.1.4 while NKJV's does.
test('a verse only the parallel column has is kept, led by the version that has it', () => {
  const { verses } = load({ 'ROM.1.4': { primary: null, parallel: english } });
  const [verse] = stored(verses(['ROM.1.4']));
  assert.deepEqual([verse.primary.abbr, verse.primary.versionId, verse.primary.text], ['NKJV', '114', 'Consecrate to Me']);
  assert.equal(verse.parallel, null);
});

test('that verse takes its reference from the column that has it', () => {
  const { asked, verses } = load(
    { 'ROM.1.4': { primary: null, parallel: english } },
    { 'ROM.1.4': { 114: 'Romans 1:4' } },
  );
  assert.equal(stored(verses(['ROM.1.4']))[0].displayRef, 'Romans 1:4');
  assert.deepEqual(asked, ['114']);
});

// Neither silently dropped nor invented: the save fails and says which verse.
test('a verse with neither side reaches the worker and is refused', () => {
  const { verses } = load({ 'EXO.13.2': { primary: null, parallel: null } });
  assert.throws(() => stored(verses(['EXO.13.2'])), /EXO\.13\.2 has no primary text/);
});

test('several verses make one entry each, in the order the selection gave them', () => {
  const { verses } = load({
    'EXO.13.2': { primary: tamil, parallel: english },
    'EXO.13.4': { primary: tamil, parallel: english },
  });
  assert.deepEqual(stored(verses(['EXO.13.2', 'EXO.13.4'])).map((v) => v.usfm), ['EXO.13.2', 'EXO.13.4']);
});
