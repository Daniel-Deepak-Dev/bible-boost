/*
 * src/shared/normalize.js — the one route text takes before anything compares it.
 *
 * Tamil is in here on purpose and not as an afterthought. Every mistake this module can make is
 * invisible in English: composed and decomposed forms only differ outside Latin text, and
 * toLowerCase agrees with toLocaleLowerCase on any machine set to English.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, fold, tokenize } from '../src/shared/normalize.js';

// ---------- Fixtures ----------
// மோசே (Moses). Its first vowel sign is U+0BCB, one of only four Tamil code points with a canonical
// decomposition, which is what makes this word able to arrive in two spellings at all.
//
// Written as escapes and never as literals. An editor that normalizes on save would turn a literal
// decomposed form into the composed one without changing how it looks, and every test below would
// then be comparing a string with itself and passing. The first test exists to catch exactly that.
const MOSES_COMPOSED = 'மோசே';
const MOSES_DECOMPOSED = '\u0BAE\u0BC7\u0BBE\u0B9A\u0BC7';

test('the Tamil fixtures really are two different spellings', () => {
  assert.notEqual(MOSES_DECOMPOSED, MOSES_COMPOSED);
  assert.equal(MOSES_DECOMPOSED.length, MOSES_COMPOSED.length + 1);
});

// ---------- normalizeText ----------
test('normalizeText composes a decomposed Tamil word and leaves a composed one alone', () => {
  assert.equal(normalizeText(MOSES_DECOMPOSED), MOSES_COMPOSED);
  assert.equal(normalizeText(MOSES_COMPOSED), MOSES_COMPOSED);
});

// The whole of Tamil's canonical decompositions, so a future "optimisation" that special-cases the
// common vowel signs is caught on the two rare ones.
//
// The notEqual is the same guard as the first test, for these four. Until B-016 every decomposed
// fixture in this file was a literal, whatever the comment at the top said, and this test had no
// guard of its own, so one normalizing save would have left it comparing each sign with itself.
test('normalizeText composes all four Tamil decompositions', () => {
  const pairs = [
    ['\u0BC6\u0BBE', 'ொ'],
    ['\u0BC7\u0BBE', 'ோ'],
    ['\u0BC6\u0BD7', 'ௌ'],
    ['\u0B92\u0BD7', 'ஔ'],
  ];
  for (const [decomposed, composed] of pairs) {
    assert.notEqual(decomposed, composed);
    assert.equal(normalizeText(decomposed), composed);
  }
});

test('normalizeText leaves case alone', () => {
  assert.equal(normalizeText('Grace'), 'Grace');
});

test('normalizeText turns anything that is not a string into an empty string', () => {
  for (const value of [null, undefined, 42, {}, []]) assert.equal(normalizeText(value), '');
});

// ---------- fold ----------
test('fold gives a composed and a decomposed Tamil word the same result', () => {
  assert.equal(fold(MOSES_DECOMPOSED), fold(MOSES_COMPOSED));
});

test('fold keeps Tamil vowel signs, which are part of the word and not accents', () => {
  assert.equal(fold(MOSES_COMPOSED), MOSES_COMPOSED);
});

// GRACE rather than FAITH: under a Turkish locale I lowercases to a dotless letter, and this test
// should not fail because of where the machine running it happens to be.
test('fold lowercases English', () => {
  assert.equal(fold('GRACE'), 'grace');
});

// On an English machine the two lowercasing methods return identical strings, so comparing output
// can never tell them apart. Replacing the method is the only way to prove which one ran, and
// recording its receiver proves NFC already happened by the time it did.
test('fold uses toLocaleLowerCase, and runs it after NFC', (t) => {
  let received;
  t.mock.method(String.prototype, 'toLocaleLowerCase', function record() {
    received = String(this);
    return 'folded';
  });
  const result = fold(MOSES_DECOMPOSED);
  t.mock.restoreAll();
  assert.equal(result, 'folded');
  assert.equal(received, MOSES_COMPOSED);
});

test('fold turns anything that is not a string into an empty string', () => {
  for (const value of [null, undefined, 42]) assert.equal(fold(value), '');
});

// ---------- tokenize ----------
test('tokenize splits a Tamil phrase into its words', () => {
  assert.deepEqual(tokenize('கர்த்தர் மோசேயை நோக்கி:'), ['கர்த்தர்', 'மோசேயை', 'நோக்கி']);
});

// சொல் ("word"): a vowel sign and a pulli, the two kinds of mark a Latin-minded tokenizer drops.
// \w matches neither, and \p{M} characters are deliberately not in the split class.
test('tokenize keeps vowel signs and the pulli inside the token', () => {
  const word = 'சொல்';
  assert.deepEqual(tokenize(word), [word]);
});

// What T-036 R8 depends on: a query typed in one spelling has to find a note saved in the other.
test('tokenize gives the same token for a composed and a decomposed word', () => {
  assert.deepEqual(tokenize(MOSES_DECOMPOSED), tokenize(MOSES_COMPOSED));
});

test('tokenize handles Tamil and English in one string', () => {
  assert.deepEqual(tokenize('கர்த்தர் said, மோசே GO!'), ['கர்த்தர்', 'said', 'மோசே', 'go']);
});

test('tokenize splits on the Unicode spaces the DOM produces', () => {
  assert.deepEqual(tokenize('grace peace hope'), ['grace', 'peace', 'hope']);
});

test('tokenize splits on Unicode punctuation and symbols', () => {
  assert.deepEqual(tokenize('grace—peace+hope'), ['grace', 'peace', 'hope']);
});

test('tokenize keeps numbers', () => {
  assert.deepEqual(tokenize('Psalm 119'), ['psalm', '119']);
});

test('tokenize returns no tokens when there are no words', () => {
  for (const value of ['', '   ', '—, !', null, undefined]) assert.deepEqual(tokenize(value), []);
});
