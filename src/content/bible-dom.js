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
  // /bible/<versionId>/<slug>. Not anchored, so whatever comes before /bible/ is no concern of ours,
  // and shared by the code that reads this path and the code that rewrites it (T-056).
  const PATH_RE = /\/bible\/(\d+)\/([^/?#]+)/;

  // /bible/339/EXO.13.TAOVBSI?parallel=114
  // Book codes are always 3 chars (JHN, 1CO, 3JN) and a chapter is always digits, so this also
  // rejects book-intro refs like "JHN.INTRO1", which bible.com renders with no parallel column.
  const REF_RE = /^([A-Z0-9]{3})\.(\d+)/;

  // The version abbreviation, which is whatever follows BOOK.CHAPTER and any verses:
  //   EXO.13.TAOVBSI   JHN.3.16.NIV   EXO.13.1-2,4.TAOVBSI   JHN.INTRO1.NIV
  // Not "the third part", because a verse URL puts it fourth. It can also be missing altogether:
  // /bible/111/JHN.1 is a real page that bible.com serves without redirecting, and it is the URL the
  // popup's Open button builds. A chapter-and-verse slug with no abbreviation, JHN.3.16, would then
  // read as "the abbreviation is 16", which is what the lookahead refuses.
  const ABBR_RE = /^[A-Z0-9]{3}\.[A-Z0-9]+(?:\.[\d,-]+)?\.(?![\d,-]+$)(.+)$/;

  // Decoded because bible.com writes it percent-encoded: version 48 links to
  // /bible/48/EXO.13.CUNPSS-%E7%A5%9E while its own chip reads CUNPSS-神. The catch is not padding.
  // align() calls parseUrl on every pass, and decodeURIComponent throws on a stray %, so a mistyped
  // URL would otherwise take the alignment down over a field it never reads.
  function abbrOfSlug(slug) {
    const m = slug.match(ABBR_RE);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch { return null; }
  }

  function parseUrl(href = location.href) {
    const u = new URL(href);
    const m = u.pathname.match(PATH_RE);
    if (!m) return null;
    const par = u.searchParams.get('parallel');
    const r = m[2].match(REF_RE); // "JHN.3.16.NIV" -> JHN.3, the chapter, which is what we want
    return {
      id: m[1],
      ref: r ? `${r[1]}.${r[2]}` : null,
      parallel: par && /^\d+$/.test(par) ? par : null,
      abbr: abbrOfSlug(m[2]), // of the version at id, and null when the URL does not carry one
    };
  }

  // The slug the same page goes by under the other version (T-056 R4 to R7).
  //
  // The old abbreviation names the version that just left the path, so it can never stay: NKJV's
  // page would be calling itself TAOVBSI. It comes off through ABBR_RE's raw capture and not through
  // abbrOfSlug, which is decoded, so no longer the text in the slug, and which answers null for
  // EXO.13.BAD%E7, where the abbreviation would then be left in place. The capture always runs to
  // the end of the slug, so slicing its length off the end cannot touch anything else.
  //
  // With nothing usable to put back, the slug simply ends at the chapter or verse, which bible.com
  // serves without a redirect (01-urls-and-routing.md, trap 4). A bare number is not usable:
  // resolveVersion answers with the numeric id when it knows nothing better, and EXO.13.114 would
  // read as a verse. The test is the character class from ABBR_RE's own lookahead, so writing a slug
  // and reading one cannot disagree about what counts as verses, and NASB1995 still gets through.
  function swappedSlug(slug, newPrimaryAbbr) {
    const old = slug.match(ABBR_RE)?.[1];
    const base = old ? slug.slice(0, -old.length - 1) : slug; // the 1 is the dot in front of it
    const usable = newPrimaryAbbr && !/^[\d,-]+$/.test(newPrimaryAbbr);
    return usable ? `${base}.${encodeURIComponent(newPrimaryAbbr)}` : base;
  }

  // The same page with the two versions trading sides, or null when there is nothing to trade.
  //
  // bible.com has no left-or-right setting. The version in the path goes on the left and the one in
  // ?parallel= on the right, measured on 2026-11-10 with 114 then 339, 339 then 114, 114 then 392 and
  // 114 then 111, so rewriting the URL is the whole of a swap.
  //
  // The dock decides whether its button exists from this answer (T-057), which is why every reason
  // for there being nothing to swap is settled here and not restated there. A ?parallel= repeating
  // the id renders one column, and a book intro, whose ref is null, renders no parallel column at all.
  //
  // The rewrite goes through a function and not a replacement string, because a $ in a slug would
  // otherwise be read as a capture group.
  function swappedUrl(href = location.href, newPrimaryAbbr = null) {
    const loc = parseUrl(href);
    if (!loc || !loc.ref || !loc.parallel || loc.parallel === loc.id) return null;
    const u = new URL(href);
    u.pathname = u.pathname.replace(PATH_RE, (_, __, slug) => `/bible/${loc.parallel}/${swappedSlug(slug, newPrimaryAbbr)}`);
    u.searchParams.set('parallel', loc.id);
    return u.toString();
  }

  // ---------- Columns ----------
  // bible.com tags each column with a vidNNN class, in a shape that depends on the version: most are
  // "version vid59 iso6393eng", while NIV is a hashed "cat7xG_vid111" with no "version" class at all,
  // in either column. Match the vid token itself instead of either wrapper.
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
  // What counts as a verse element, in one place. The class half is doing real work: the chapter
  // wrapper carries data-usfm as well ("EXO.13", on a "cat7xG_chapter" div), so a bare [data-usfm]
  // query on Exodus 13 finds 44 elements where there are 43 verse elements.
  const VERSE_SEL = '[class*="_verse"][data-usfm]';

  // The canonical key of a verse element. CEV writes Romans 1:3-4 as "ROM.1.3+ROM.1.4", and the rule
  // everywhere is to keep the part before the plus (02-verse-dom.md).
  function usfmOf(el) {
    return el.getAttribute('data-usfm').split('+')[0];
  }

  // usfm ("JHN.1.5") -> first element of that verse (a verse can be split across paragraphs).
  // A Map keeps insertion order, which is document order, which is the top-to-bottom order the
  // single-pass accumulation in align() needs. Keying on the usfm rather than the bare verse
  // number means two chapters rendered on one page can never collide.
  function firstSpans(col) {
    const map = new Map();
    col.querySelectorAll(VERSE_SEL).forEach((el) => {
      const key = usfmOf(el);
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

  BB.dom = { REF_RE, VID_RE, LANG_RE, VERSE_SEL, parseUrl, swappedUrl, columnEls, columns, langOf, usfmOf, firstSpans, verseLabel };
})();
