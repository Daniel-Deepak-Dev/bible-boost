/*
 * BibleBoost — the versions the popup offers
 * One table, read from places that cannot share a module: the popup and the tests import it through
 * refs.js, and capture.js reads it as BB.VERSIONS.
 *
 * This is the one file in src/shared/ that loads two ways, which is why it has no export. A content
 * script is a classic script, where the word `export` is a SyntaxError, and a manifest cannot list an
 * ES module (05-mv3-constraints.md). globalThis is the same object to both kinds of script. In the
 * content scripts' isolated world it is where bible-dom.js's `var BB` lives, so either file can run
 * first and the other adds to what it finds.
 *
 * It is not a list of bible.com's versions, and T-011 does not want one. A user can be reading any id
 * at all, and resolveVersion treats a miss here as ordinary (03-columns-and-versions.md).
 */

// A Map and not an object keyed by id, because an object visits integer-like keys in ascending order
// whatever order they were written in. The popup would then list KJV first and NKJV fourth, with no
// error anywhere to say the order had changed.
//
// name is the popup's label, moved here as written, so that moving the table cannot change what the
// dropdown shows.
//
// What the page reveals about a version not listed here stays out of this table (T-011 R6). It belongs
// on the note that captured it, and other code trusts everything it finds in here.
(globalThis.BB ??= {}).VERSIONS = new Map([
  ['114', Object.freeze({ abbr: 'NKJV', name: 'NKJV — New King James' })],
  ['1', Object.freeze({ abbr: 'KJV', name: 'KJV — King James' })],
  ['111', Object.freeze({ abbr: 'NIV', name: 'NIV' })],
  ['59', Object.freeze({ abbr: 'ESV', name: 'ESV' })],
  ['100', Object.freeze({ abbr: 'NASB1995', name: 'NASB1995' })],
  ['116', Object.freeze({ abbr: 'NLT', name: 'NLT' })],
  ['339', Object.freeze({ abbr: 'TAOVBSI', name: 'TAOVBSI — Tamil O.V. (BSI)' })],
]);
