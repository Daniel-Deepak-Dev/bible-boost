/*
 * src/ui/app/list.js — the two-line preview a list row shows (T-021 R5).
 *
 * Only previewOf is here. The list itself is DOM, and stays a manual check (test/README.md). list.js
 * touches the DOM and chrome.* only inside its functions, so importing it in Node is itself a check
 * that it stays that way.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewOf } from '../src/ui/app/list.js';

test('previewOf takes the # off a heading', () => {
  assert.equal(previewOf('# Consecrate the firstborn'), 'Consecrate the firstborn');
  assert.equal(previewOf('### விசுவாசம்'), 'விசுவாசம்');
});

test('previewOf takes the marker off each list item and runs the lines together', () => {
  assert.equal(previewOf('- faith\n* hope\n+ love'), 'faith hope love');
  assert.equal(previewOf('1. first\n2) second'), 'first second');
  assert.equal(previewOf('- [ ] to read\n- [x] read'), 'to read read');
});

test('previewOf takes the > off a quote, and a heading inside one', () => {
  assert.equal(previewOf('> # Remember this day'), 'Remember this day');
  assert.equal(previewOf('> > nested'), 'nested');
});

test('previewOf leaves syntax in the middle of a line alone', () => {
  assert.equal(previewOf('Verse 2 # not a heading - nor a list'), 'Verse 2 # not a heading - nor a list');
  assert.equal(previewOf('#hashtag'), '#hashtag');
});

test('previewOf drops blank lines and Windows line ends', () => {
  assert.equal(previewOf('one\r\n\r\n\r\ntwo'), 'one two');
});

// Tamil passes through untouched: no character is dropped or split, and the result is compared with
// the same composed string it came from.
test('previewOf keeps Tamil text whole', () => {
  const tamil = 'முதற்பேறான யாவையும் எனக்குப் பரிசுத்தப்படுத்து';
  assert.equal(previewOf(`## ${tamil}\n- ${tamil}`), `${tamil} ${tamil}`);
});

test('previewOf of nothing is an empty string', () => {
  assert.equal(previewOf(''), '');
  assert.equal(previewOf(undefined), '');
  assert.equal(previewOf('#\n-\n>'), '');
});

test('previewOf keeps a long body out of layout', () => {
  assert.ok(previewOf('word '.repeat(1000)).length <= 1000);
});
