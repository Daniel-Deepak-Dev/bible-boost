/*
 * BibleBoost — bible.com DOM readers
 * Everything that knows how to READ bible.com's reader page lives here: which chapter is open,
 * which elements are the columns, where each verse starts, which element is its number. The
 * alignment in content.js and the note capture built on top of it must read the page through the
 * SAME selectors. A second copy is the one that does not get fixed when bible.com ships a new
 * build, and nothing tells you it has rotted.
 *
 * Content scripts are classic scripts, so this cannot be an ES module. Instead the manifest lists
 * this file FIRST in content_scripts[0].js, Chrome runs the files in that order in one isolated
 * world, and every later file reaches these readers through BB.dom.
 *
 * Exactly one name escapes this file, and that is BB. Classic scripts share a single global scope,
 * so a top-level const here would be visible as a bare name to every later content script, and a
 * later file declaring its own REF_RE would not load at all ("Identifier 'REF_RE' has already been
 * declared"). Hence the IIFE. BB itself is a var rather than a const for the same reason turned
 * around: a var may be declared again in another file and a const may not, and the typeof test
 * keeps whatever an earlier file already hung on it. Whichever file runs first creates BB, and no
 * order of files can break it.
 */
var BB = (typeof BB !== 'undefined') ? BB : {};

(() => {
  // ---------- URL ----------
  // /bible/339/EXO.13.TAOVBSI?parallel=114
  // Book codes are always 3 chars (JHN, 1CO, 3JN) and a chapter is always digits, so this also
  // rejects book-intro refs like "JHN.INTRO1", which bible.com renders with no parallel column.
  const REF_RE = /^([A-Z0-9]{3})\.(\d+)/;

  function parseUrl(href = location.href) {
    const u = new URL(href);
    const m = u.pathname.match(/\/bible\/(\d+)\/([^/?#]+)/);
    if (!m) return null;
    const par = u.searchParams.get('parallel');
    const r = m[2].match(REF_RE); // "JHN.3.16.NIV" -> JHN.3, the chapter, which is what we want
    return {
      id: m[1],
      ref: r ? `${r[1]}.${r[2]}` : null,
      parallel: par && /^\d+$/.test(par) ? par : null,
    };
  }

  // ---------- Columns ----------
  // bible.com tags each column with a vidNNN class, but inconsistently: the parallel column is
  // "version vid59 iso6393eng" while the primary one is a hashed "cat7xG_vid111" with no "version"
  // class at all. Match the vid token itself instead of either wrapper.
  const VID_RE = /(?:^|[\s_])vid(\d+)(?:\s|$)/;

  function columnEls() {
    const hits = [...document.querySelectorAll('div[class*="vid"]')]
      .filter((c) => VID_RE.test(c.getAttribute('class') || ''));
    const seen = new Set();
    return hits.filter((c) => {
      if (hits.some((o) => o !== c && c.contains(o))) return false; // keep the innermost wrapper
      const vid = c.getAttribute('class').match(VID_RE)[1];
      if (seen.has(vid)) return false; // one element per version
      seen.add(vid);
      return true;
    });
  }

  function columns() {
    // bible.com hides the 2nd column on narrow screens (display:none -> no client rects)
    const cols = columnEls().filter((c) => c.getClientRects().length);
    return cols.length === 2 ? cols : null;
  }

  // ---------- Language ----------
  // The same class list that carries the vid token carries an ISO 639-3 language code beside it:
  // "version vid59 iso6393eng". It tells a saved verse which language, and so which script, it is
  // in without guessing from the text, which on a page that is half Tamil is not a guess worth
  // making. Same token boundaries as VID_RE, so a hashed "xYz_iso6393tam" matches as well.
  const LANG_RE = /(?:^|[\s_])iso6393([a-z]{3})(?:\s|$)/;

  // col (one of columnEls()) -> 'eng', 'tam', ... or null. T-011 stores this on a saved verse and
  // reads null as "unknown": a missing token must come back as null, never as a default language
  // and never as a throw, because an unrecognised version must not block a save.
  function langOf(col) {
    const m = (col.getAttribute('class') || '').match(LANG_RE);
    return m ? m[1] : null;
  }

  // ---------- Verses ----------
  // usfm ("JHN.1.5") -> first element of that verse (a verse can be split across paragraphs).
  // A Map keeps insertion order, which is document order, which is the top-to-bottom order the
  // single-pass accumulation in align() needs. Keying on the usfm rather than the bare verse
  // number means two chapters rendered on one page can never collide.
  function firstSpans(col) {
    const map = new Map();
    col.querySelectorAll('[class*="_verse"][data-usfm]').forEach((el) => {
      const key = el.getAttribute('data-usfm').split('+')[0]; // combined "JHN.1.1+JHN.1.2"
      if (!map.has(key)) map.set(key, el);
    });
    return map;
  }

  // The verse-number label, and only it: a verse's own label is a direct child, while a footnote
  // marker is a [class*="_label"] nested deeper inside. A verse element that has no direct label is
  // a continuation fragment — the tail of a verse that spilled into the next paragraph.
  function verseLabel(el) {
    return el.querySelector(':scope > [class*="_label"]');
  }

  BB.dom = { REF_RE, VID_RE, LANG_RE, parseUrl, columnEls, columns, langOf, firstSpans, verseLabel };
})();
