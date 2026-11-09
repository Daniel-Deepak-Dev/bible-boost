/*
 * BibleBoost — text normalization
 * The one route text takes before anything compares it. work/understandings/bible-com/07-i18n-and-scripts.md
 * holds the rules; this file is those rules as code, and the two must agree.
 *
 * A mistake here does not raise an error. It produces a search that quietly fails to match things,
 * and only for the Tamil half of the content, so none of it shows up when testing in English.
 *
 * Nothing in here may touch chrome.* or the DOM. The file has to load in plain Node so that
 * `node --test` can cover it (T-007 R3).
 */

// ---------- Normalizing ----------
// NFC, because the same Tamil word can arrive in two spellings that look identical and compare
// unequal. U+0BCB, the vowel sign in மோ, can also be written as U+0BC7 U+0BBE, and which one a string
// holds depends on the input method and the source. Tamil has exactly four such code points: U+0BCA,
// U+0BCB, U+0BCC and U+0B94.
//
// Anything that is not a string becomes '', the same as normalizeTag in schema.js, so a caller can
// pass a field that may be missing without checking it first.
//
// T-037 R8 adds whitespace collapsing here. Tokenizing does not need it, because \s already matches
// U+00A0 and the other Unicode spaces.
export const normalizeText = (s) => (typeof s === 'string' ? s.normalize('NFC') : '');

// ---------- Folding ----------
// NFC first and case second, and toLocaleLowerCase rather than toLowerCase. The two lowercasing
// methods return the same thing on any machine set to English and differ elsewhere, which is exactly
// why someone will one day "simplify" this. test/normalize.test.js mocks the method so that it can
// tell them apart.
//
// Nothing is stripped. Tamil vowel signs are combining marks (\p{M}) but they are not accents:
// removing one changes the word (T-037 R7).
export const fold = (s) => normalizeText(s).toLocaleLowerCase();

// ---------- Tokenizing ----------
// Splits on Unicode classes, and never on the regex word-character class or a word boundary. Both
// are defined on ASCII, so the class does not match a single letter of Tamil and a boundary
// assertion finds nothing inside a Tamil word. That sentence avoids spelling either escape because
// T-037's acceptance list allows no literal word-boundary escape anywhere in this module.
//
// Marks are deliberately missing from the class. The vowel signs and the pulli (U+0BCD) are \p{M},
// so they stay inside the token. \p{S} is included because + and = are symbols rather than
// punctuation, and a note reading "faith+works" should find both words.
const TOKEN_SPLIT_RE = /[\s\p{P}\p{S}]+/u;

// Folds as well as splits, so the index and the query cannot end up going through different steps.
// T-036 R8 calls that mismatch the classic cause of "it is definitely in there but search cannot
// find it". No stemming, for the same reason there is no search library (T-037 R6).
export const tokenize = (s) => fold(s).split(TOKEN_SPLIT_RE).filter(Boolean);
