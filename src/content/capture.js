/*
 * BibleBoost — which verses are selected right now
 * Answers that one question for the features that save a verse, and says when the answer changes.
 * What bible.com actually does on a selection is written down in
 * work/understandings/bible-com/06-verse-action-menu.md; this file is the code that relies on it.
 *
 * Three strategies, tried in order, because each one rests on something bible.com could change:
 *   class  the class bible.com puts on a selected verse, learned at runtime and never hardcoded
 *   menu   the reference in the header of bible.com's own verse menu
 *   text   the browser's text selection, which is how a verse in the parallel column gets selected
 *          at all: on bible.com only the primary column responds to a tap
 *
 * Classic script, for the same reasons as bible-dom.js, and the manifest runs it AFTER content.js.
 * That order is safe because content.js only reaches BB.capture from inside its observer callback,
 * by which time every content script has run. If this file failed to load, that lookup comes back
 * undefined and alignment carries on without it.
 */
var BB = (typeof BB !== 'undefined') ? BB : {};

(() => {
  const { VERSE_SEL, VID_RE, parseUrl, columnEls, firstSpans, usfmOf } = BB.dom;

  // ---------- Reading verses ----------
  // Every verse element in the reader columns, fragments included, in document order. All three
  // strategies read through this so that "only the reader columns" holds by construction: bible.com
  // clones verse nodes into popovers and share sheets, and those clones must never count (R8).
  function verseEls() {
    return columnEls().flatMap((col) => [...col.querySelectorAll(VERSE_SEL)]);
  }

  // Elements -> canonical keys, one per verse, in the order given. The de-duplication is not
  // defensive: Exodus 13 in TAOVBSI has 43 verse elements for 22 verses, because most verses are
  // followed by a whitespace-only fragment carrying the same data-usfm, and bible.com puts the
  // selected class on both.
  function usfmsOf(els) {
    return [...new Set(els.map(usfmOf))];
  }

  // ---------- Learning the selection class ----------
  // bible.com's build names the class "cat7xG_verse-selected" today. Any later build can rename it,
  // which is why it is learned here rather than written down, the same lesson as the old /_s\d/
  // heading test that never once matched a live page.
  const classOf = (el) => el.getAttribute('class') || '';
  const tokensOf = (cls) => cls.split(/\s+/).filter(Boolean);

  const seen = new WeakMap(); // verse element -> its class attribute when last looked at
  let token = null;           // the learned selection class, or null while there is none

  // A class change can only be diffed against something seen BEFORE it, so verses have to be on
  // record ahead of the first tap. Hence once at load and again whenever the tree changes, because
  // chapter navigation replaces every verse node (the old ones end up disconnected). Elements already
  // on record are left alone: overwriting one would erase a diff that has not been read yet.
  function seed(els) {
    for (const el of els) if (!seen.has(el)) seen.set(el, classOf(el));
  }

  function forgetToken(why) {
    console.debug('[BibleBoost] capture: dropped selection class', token, `(${why})`);
    token = null;
  }

  // gains: for each verse element that gained classes in this batch, the classes it gained.
  //
  // A class that is still on some verse stays, however many other classes turned up, so a passing
  // change cannot displace a working answer. A class that is on no verse at all is dead, and this is
  // where it gets replaced: on the very next tap, not after a reload.
  //
  // The every() check refuses a class that is on every verse in the columns. That describes a page
  // state, not a selection, and learning it would report the whole chapter as selected.
  function learn(gains) {
    const all = verseEls();
    if (token && all.some((el) => el.classList.contains(token))) return;
    const common = gains.reduce((kept, list) => kept.filter((t) => list.includes(t)));
    const found = common.find((t) => !all.every((el) => el.classList.contains(t)));
    if (!found || found === token) return;
    token = found;
    console.debug('[BibleBoost] capture: learned selection class', found);
  }

  // Called from the observer in content.js, after the T-004 guard, with the same records it was
  // given. That is why this file has no observer of its own (R2), and why the work here has to stay
  // proportional to the records: bible.com rewrites the class attribute of every verse in BOTH
  // columns on every tap, nearly always to the value it already had. Measured on Exodus 13 in
  // parallel: 65 records for one tap, 63 of them no-ops, which the comparison below discards.
  function noteMutations(records) {
    const targets = new Set();
    let treeChanged = false;
    for (const r of records) {
      if (r.type === 'attributes') targets.add(r.target);
      else if (r.type === 'childList') treeChanged = true;
    }

    const cols = columnEls();
    const gains = [];
    for (const el of targets) {
      if (!el.matches(VERSE_SEL) || !cols.some((c) => c.contains(el))) continue;
      const before = seen.get(el);
      const now = classOf(el);
      seen.set(el, now);
      if (before === undefined || before === now) continue;
      const had = new Set(tokensOf(before));
      const fresh = tokensOf(now).filter((t) => !had.has(t));
      if (fresh.length) gains.push(fresh);
    }

    if (gains.length) learn(gains);
    if (treeChanged) seed(verseEls());
    queueCheck();
  }

  // ---------- Strategy: class ----------
  function readClass() {
    if (!token) return null;
    const hits = verseEls().filter((el) => el.classList.contains(token));
    return hits.length ? usfmsOf(hits) : null;
  }

  // ---------- Strategy: menu ----------
  // The menu's header is a link whose href is already canonical: /bible/339/EXO.13.1-2,4.TAOVBSI.
  // It is read instead of the visible text because that text is localized, and picking digits out of
  // it is a trap of its own: a book can be "1 கொரிந்தியர்" and a version abbreviation can contain
  // digits. Not anchored at the start, the same as parseUrl, so a locale prefix on the path still
  // matches.
  const MENU_HREF_RE = /\/bible\/(\d+)\/([A-Z0-9]{3}\.\d+)\.(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)\.[^/?#]+/;

  // The menu stays mounted off-screen the whole time, selected or not, so its presence means nothing.
  // Its href is the signal: with nothing selected it reads /bible/339/EXO.13.TAOVBSI, which has no
  // verses and fails the pattern. That also makes a visibility check unnecessary.
  //
  // Searching <main> rather than the document matters. The sidebar's Recents list can hold a verse
  // link (it does once a /bible/339/EXO.13.2.TAOVBSI page has been visited), and on the matching
  // chapter that link would report a selection with nothing selected. The sidebar is outside <main>.
  //
  // Verses are looked up in the column of the version the link names, instead of being expanded from
  // the range. That way the order is document order, a range cannot run away, and a combined verse
  // comes out right: the header says 3-4 for CEV's "ROM.1.3+ROM.1.4", the column's only key is
  // ROM.1.3, and a parallel NKJV column that really does have a verse 4 is not consulted.
  function readMenu() {
    const ref = parseUrl()?.ref;
    const main = document.querySelector('main');
    if (!ref || !main) return null;
    const cols = columnEls();
    for (const a of main.querySelectorAll('a[href*="/bible/"]')) {
      const m = a.getAttribute('href').match(MENU_HREF_RE);
      if (!m || m[2] !== ref || cols.some((c) => c.contains(a))) continue;
      const col = cols.find((c) => c.getAttribute('class').match(VID_RE)?.[1] === m[1]);
      if (!col) continue;
      const ranges = m[3].split(',').map((part) => part.split('-').map(Number));
      const picked = (n) => ranges.some(([from, to = from]) => n >= from && n <= to);
      const prefix = `${ref}.`;
      const usfms = [...firstSpans(col).keys()]
        .filter((key) => key.startsWith(prefix) && picked(Number(key.slice(prefix.length))));
      if (usfms.length) return usfms;
    }
    return null;
  }

  // ---------- Strategy: text ----------
  // Whether the range covers any actual text of this verse, as opposed to merely touching it. Most
  // verses are followed by a whitespace-only fragment, and a selection that ends at the start of the
  // next verse touches that verse without selecting a letter of it.
  function overlapsText(range, el) {
    const part = document.createRange();
    part.selectNodeContents(el);
    if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) part.setStart(range.startContainer, range.startOffset);
    if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) part.setEnd(range.endContainer, range.endOffset);
    return part.toString().trim() !== '';
  }

  // Every column verse is tested against the range, rather than walking down from the range's common
  // ancestor. A drag across two verses has the whole chapter wrapper as its common ancestor, so every
  // verse in the chapter is a descendant, while a drag inside one verse has an ancestor with no verse
  // below it at all. intersectsNode() comes first because it is cheaper than building a Range.
  //
  // window.getSelection and not the bare name: inside this function's scope, getSelection is ours.
  function readText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const hits = verseEls().filter((el) => range.intersectsNode(el) && overlapsText(range, el));
    return hits.length ? usfmsOf(hits) : null;
  }

  // ---------- Re-verifying the learned class ----------
  // The learned class is a guess that was right once (R2). The menu's header is the one thing on the
  // page that owes nothing to that guess, because bible.com writes it for its own purposes, so it is
  // what the guess gets checked against.
  //
  // Whenever the menu names verses, the class has to name the same ones or it loses the right to
  // answer. That covers a class that has gone dead (on no verse at all) and one sitting on the wrong
  // verses. Dropping one by mistake is cheap: the menu answers in its place and the next tap relearns.
  //
  // When the menu names nothing, the class is left alone, because there is nothing to check it
  // against. That is either the ordinary no-selection state or a redesign that broke the header, and
  // dropping the class on the strength of it would let a header change take out the primary strategy
  // too. The price is that a wrongly learned class goes unchallenged while nothing is selected, which
  // is why learn() refuses a class on every verse and never replaces one that is still in use.
  //
  // byClass and byMenu are each a usfm array in document order, or null. Returns the class answer
  // getSelection may use, or null to make it move on to the menu.
  function reconcile(byClass, byMenu) {
    if (!token || !byMenu || byClass?.join() === byMenu.join()) return byClass;
    forgetToken(byClass ? 'disagrees with the menu' : 'on no verse while the menu names some');
    return null;
  }

  // ---------- Answering ----------
  function answer() {
    const byMenu = readMenu();
    const byClass = reconcile(readClass(), byMenu);
    if (byClass) return { usfms: byClass, source: 'class' };
    if (byMenu) return { usfms: byMenu, source: 'menu' };
    const byText = readText();
    return byText ? { usfms: byText, source: 'text' } : null;
  }

  // console.debug on purpose, and only when the level changes. DEBUG_SCHEDULE in content.js uses
  // console.log because silence is its passing result. Here the point is the opposite: a user can
  // switch on Verbose and read which level is answering, with no flag to edit and nothing printed
  // for everyone else.
  let lastSource = null;
  function reportSource(source) {
    if (source === lastSource) return;
    lastSource = source;
    console.debug('[BibleBoost] capture: answered by', source ?? 'nothing');
  }

  // { usfms, source } or null, never an empty array and never a throw (R7). Callers branch on null,
  // and this reads a page that can change shape without warning.
  function getSelection() {
    try {
      const result = answer();
      reportSource(result?.source ?? null);
      return result;
    } catch (err) {
      console.debug('[BibleBoost] capture: getSelection failed', err);
      return null;
    }
  }

  // ---------- Notifying ----------
  const listeners = new Set();
  let lastKey = '';
  let checkTimer = null;

  // The verses are what callers care about, so a change of source alone notifies nobody. Listeners
  // are isolated from each other because this runs off the page's own events, and one broken chip
  // should not cost the menu row its update.
  function check() {
    const now = getSelection();
    const key = now ? now.usfms.join() : '';
    if (key === lastKey) return;
    lastKey = key;
    for (const cb of listeners) {
      try { cb(now); } catch (err) { console.error('[BibleBoost] capture: listener failed', err); }
    }
  }

  // The same 80 ms content.js settles on for schedule(). selectionchange fires on every step of a
  // drag, and one tap arrives as a storm of class records.
  function queueCheck() {
    if (checkTimer) return;
    checkTimer = setTimeout(() => { checkTimer = null; check(); }, 80);
  }

  // cb receives what getSelection returns. Returns a function that removes it again (T-013 R10).
  function onChange(cb) {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }

  // ---------- Init ----------
  seed(verseEls());
  // Text selection never touches the DOM, so no mutation record will ever report it.
  document.addEventListener('selectionchange', queueCheck);

  BB.capture = {
    getSelection,
    onChange,
    noteMutations,
    // For the console, from the extension's own context: the acceptance check that overwrites the
    // cached class to prove it gets rediscovered needs some way to reach it.
    debug: {
      get token() { return token; },
      set token(value) { token = value; },
    },
  };
})();
