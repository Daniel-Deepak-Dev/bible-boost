(() => {
  /*
   * BibleBoost — parallel reading
   * Keeps bible.com's own verse DOM (so tap-to-highlight / copy / share / notes keep working)
   * and only adds vertical spacing before verses so verse N starts on the same line in both columns.
   */

  // Keep in sync with popup.js. chrome.storage.sync.get(DEFAULTS) fills in whatever a profile is
  // missing, so adding a key here migrates existing installs for free.
  const DEFAULTS = {
    align: true,
    separators: false,
    primaryId: '111',
    parallelId: '114',
    lastRef: 'JHN.1',
    showSwitch: true,
  };
  const store = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) || null;
  let settings = { ...DEFAULTS };
  let ready = !store; // never persist anything until the stored settings have actually loaded
  const html = document.documentElement;

  // ---------- Reading the page ----------
  // How to read bible.com's reader DOM (the URL, the columns, where each verse starts and which
  // element is its number) lives in src/content/bible-dom.js, which the manifest runs before this
  // file, so that note capture reads the page through exactly the selectors alignment relies on.
  // Bound once, here, so the code below keeps calling them by their own names and nothing in
  // align() had to change. If that file failed to load this line throws, and the extension stops
  // loudly at load instead of half-working until the first call.
  const { parseUrl, swappedUrl, columnEls, columns, firstSpans, verseLabel, VID_RE } = BB.dom;

  // ---------- Alignment ----------
  function topOf(el) {
    const label = verseLabel(el);
    const rects = (label || el).getClientRects();
    if (!rects.length) return el.getBoundingClientRect().top;
    // The label is a single rect. Without one, use the verse's FIRST line, not its last.
    return (label ? rects[rects.length - 1] : rects[0]).top;
  }

  // The chapter number and the chapter title: furniture that belongs to the chapter, not to any
  // one section inside it.
  const BAND_STOP_RE = /(?:^|\s)[^\s]*_(?:label|cl)(?:__[^\s]*)?(?=\s|$)/;

  // bible.com puts a section heading — and anything travelling with it: a psalm title (\d), a
  // speaker label (\sp), an acrostic label (\qa), a parallel-passage reference (\r) — in its own
  // block before the paragraph it introduces. Those blocks together are the "band".
  //
  // Returns the TOPMOST block of the band, which is where this row's spacer and its separator
  // belong. That one move does two things: the alignment gap opens ABOVE the heading instead of
  // between the heading and its own first verse, and the rule is drawn above the heading, so a
  // heading groups with the verses it introduces instead of being cut off from them.
  // Returns null when the verse simply follows on from another verse.
  //
  // Note it does NOT match on class name. bible.com's current build emits a plain "_s" with no
  // digit, which is why the old /_s\d/ test never once fired on a live page, and the heading is
  // often not the immediate previous sibling either (NKJV Psalm 3 runs \s then \d then the verse).
  // A band block is recognised structurally instead: it contains no verse of its own.
  //
  // Pure DOM reading, no geometry, so it is safe to call before the heights are set.
  function bandTop(el) {
    const block = el.closest('[class*="_p"], [class*="_q"], [class*="_li"]');
    if (!block) return null;
    // A block holds several verses and often OPENS with the tail of the previous one, so the verse
    // that sits against the band is the first one in the block that actually STARTS — the first
    // with a label of its own. (Requiring the literal first node here looks stricter but is wrong:
    // NIV's Song of Songs 1 opens verse 2's line with a tail of verse 1, and the "She" speaker
    // label above it would then be missed.)
    const first = [...block.querySelectorAll('[class*="_verse"][data-usfm]')].find(verseLabel);
    if (first !== el) return null;

    let top = null;
    for (let p = block.previousElementSibling; p; p = p.previousElementSibling) {
      if (p.querySelector('[class*="_verse"][data-usfm]')) break; // reached the previous verse
      if (BAND_STOP_RE.test(p.getAttribute('class') || '')) break; // chapter number / chapter title
      // Anything left is part of the band, but only a block with text of its own may anchor it.
      // A \b blank line is an empty block, and bible.com drops those between ordinary verses all
      // over the Psalms: anchoring on one would turn a plain verse row into a heading row and
      // jump its rule above the blank line. Step over it instead — it stays inside the band, it
      // just never becomes the anchor, so a \b above a heading keeps the rule on the heading.
      if (p.textContent.trim()) top = p;
    }
    return top;
  }

  let marked = new Set();
  let markedCols = [];

  function clearAlign() {
    html.removeAttribute('data-bb-align');
    html.removeAttribute('data-bb-sep');
    markedCols.forEach((c) => c.removeAttribute('data-bb-col'));
    markedCols = [];
    marked.forEach((el) => {
      el.removeAttribute('data-bb-v');
      el.style.removeProperty('--bb-gap');
      el.style.removeProperty('--bb-sep-rise');
    });
    marked = new Set();
  }

  function align() {
    const loc = parseUrl();
    const cols = settings.align && loc && loc.parallel ? columns() : null;
    if (!cols) return clearAlign();

    const [A, B] = cols.map(firstSpans);

    // Where each verse's spacer goes: the top of its heading band when it opens a section, the
    // verse itself otherwise. Resolved once, up front — bandTop() reads the DOM and nothing else,
    // so settling this here keeps it out of the measuring loop, which must not disturb layout.
    const anchor = new Map();
    for (const el of [...A.values(), ...B.values()]) anchor.set(el, bandTop(el) || el);
    const at = (el) => anchor.get(el) || el;

    const next = new Set(anchor.values());
    marked.forEach((el) => {
      if (next.has(el)) return;
      el.removeAttribute('data-bb-v');
      el.style.removeProperty('--bb-gap');
      el.style.removeProperty('--bb-sep-rise');
    });
    marked = next;

    // Verses present in BOTH columns, in document order.
    const keys = [...A.keys()].filter((k) => B.has(k));

    // A separator is drawn above its anchor, so skip the first (no rule under the chapter
    // heading). A verse that opens a section is no longer skipped the way it used to be: its
    // anchor IS the heading band, so the rule lands above the heading instead of between the
    // heading and its own first verse.
    // Both columns are decided together so the two sides stay symmetric.
    const sep = new Set();
    if (settings.separators) {
      for (let i = 1; i < keys.length; i++) { sep.add(at(A.get(keys[i]))); sep.add(at(B.get(keys[i]))); }
    }

    // Everything that affects height must be in place BEFORE the measuring pass below, or the gaps
    // get computed against ::before heights that are about to change. This ordering is also what
    // lets the measurement absorb a per-column font-size difference (0.6em is not the same number
    // of pixels in a Tamil column as in a Latin one).
    markedCols.forEach((c) => c.removeAttribute('data-bb-col'));
    markedCols = cols;
    cols.forEach((c) => c.setAttribute('data-bb-col', ''));
    html.setAttribute('data-bb-align', '');
    html.toggleAttribute('data-bb-sep', !!settings.separators);
    marked.forEach((el) => {
      el.setAttribute('data-bb-v', sep.has(el) ? 'sep' : '');
      el.style.setProperty('--bb-gap', '0px');
      el.style.removeProperty('--bb-sep-rise');
    });

    // Walk verses top to bottom. Each gap only shifts what comes after it, so one pass aligns
    // everything; reading topOf() forces the layout the previous gap just invalidated.
    // The gap is WRITTEN to the anchor but MEASURED at the verse: a gap on a heading grows the
    // heading's own box downwards from the inside, which carries the heading text and its whole
    // paragraph down with it, so the verse still moves by exactly the amount asked for.
    for (const k of keys) {
      const a = A.get(k), b = B.get(k);
      const d = Math.round(topOf(b) - topOf(a));
      if (d === 0) continue;
      at(d > 0 ? a : b).style.setProperty('--bb-gap', Math.abs(d) + 'px');
    }

    if (settings.separators) levelRules(A, B, keys, at);
  }

  // Second pass: put both columns' hairlines on the same y.
  //
  // The spacer's bottom edge was supposed to be the one y-coordinate identical in both columns,
  // but it is not. Alignment equalises the verse LABEL's top, while the rule hangs off the bottom
  // of the spacer, which is the top of the line box the label sits in. A Tamil line box is taller
  // than a Latin one, so the label sits at a different offset inside it and the two rules end up
  // about 9px apart on an ordinary row — measured on 16 of 18 rows of Exodus 13. A heading row is
  // the same fault writ large: there the anchor is the heading, so the two rules are a whole
  // heading-line apart.
  //
  // So: lift the lower rule to meet the higher one with --bb-sep-rise, and grow BOTH spacers by
  // one shared amount so the lift has box left to sit in — a background is clipped to its own
  // box, so a rule lifted past the top of the spacer does not move, it vanishes. Growing both
  // columns by the same amount is what keeps the verse tops aligned and leaves the rows below
  // untouched.
  function levelRules(A, B, keys, at) {
    const read = (n) => {
      const box = parseFloat(getComputedStyle(n, '::before').height) || 0;
      // The rule hangs off the spacer's BOTTOM edge, which is where 100% resolves to.
      return { n, box, em: parseFloat(getComputedStyle(n).fontSize), y: n.getBoundingClientRect().top + box };
    };
    for (let i = 1; i < keys.length; i++) {
      const ms = [read(at(A.get(keys[i]))), read(at(B.get(keys[i])))];
      const target = Math.min(ms[0].y, ms[1].y);
      // How far short each spacer falls of hosting the lift that column needs; take the worst.
      const grow = Math.max(0, ...ms.map((m) => (m.y - target) + 0.28 * m.em - m.box));
      for (const m of ms) {
        if (grow) {
          const had = parseFloat(m.n.style.getPropertyValue('--bb-gap')) || 0;
          m.n.style.setProperty('--bb-gap', (had + grow) + 'px');
        }
        m.n.style.setProperty('--bb-sep-rise', Math.round(m.y - target) + 'px');
      }
    }
  }

  // ---------- Parallel on/off ----------
  // bible.com collapses to a single column when ?parallel= repeats the version already in the path,
  // so never hand it the id it is already showing.
  function parallelIdFor(primary) {
    for (const id of [settings.parallelId, settings.primaryId, DEFAULTS.parallelId, DEFAULTS.primaryId]) {
      if (id && id !== primary) return id;
    }
    return DEFAULTS.parallelId;
  }

  function setParallel(on) {
    const loc = parseUrl();
    if (!loc || on === !!loc.parallel) return;
    if (!on) {
      // Prefer bible.com's own (client-side) exit link
      const exit = [...document.querySelectorAll('a[aria-label="Exit Parallel Mode"]')].find((a) => a.offsetParent);
      if (exit) return exit.click();
      const u = new URL(location.href);
      u.searchParams.delete('parallel');
      location.assign(u.toString());
    } else {
      const u = new URL(location.href);
      u.searchParams.set('parallel', parallelIdFor(loc.id));
      location.assign(u.toString());
    }
  }

  // The abbreviation of the version about to move into the path, so the address bar reads the way
  // bible.com's own links do. It is only ever a nicety, because a path without one is served as it
  // is (01-urls-and-routing.md, trap 4), so every way of not knowing it answers null and the swap
  // still goes ahead. That covers a version with no column on the page, which is what ?parallel=48
  // gave when it was looked at, and a capture.js that failed to load. This file runs before that
  // one, which is why BB.capture is read here, at the moment of the click, and through ?.
  //
  // A source of 'id' means resolveVersion found nothing and handed the number back as the
  // abbreviation, which is not one.
  function parallelAbbr() {
    const col = columnOf(parseUrl()?.parallel);
    const version = col && BB.capture?.resolveVersion(col);
    return version && version.source !== 'id' ? version.abbr : null;
  }

  // The column showing this version, whichever side it is on, or undefined when there is none.
  function columnOf(vid) {
    return columnEls().find((c) => c.getAttribute('class').match(VID_RE)?.[1] === vid);
  }

  // bible.com puts the path's version on the left, so the whole of a swap is a new URL, and the
  // memory of it is remember() storing that URL's pair when the swapped page loads. There is
  // deliberately no setting for this (T-057 R11): a stored order could only disagree with the URL.
  //
  // It is a full load, like setParallel(true) above, because window.next.router lives in the page's
  // own world and this is the isolated one. A double-click cannot swap and then swap back, since
  // location.href does not change until the navigation commits and both clicks compute one target.
  function swapSides() {
    const target = swappedUrl(location.href, parallelAbbr());
    if (!target) return;
    stashSwapPosition();
    location.assign(target);
  }

  // ---------- Reading position across a swap ----------
  // A swap is a full page load, so the reader would otherwise land at the top of the chapter, which
  // at verse 140 of Psalm 119 is a long way from where they were. So swapSides() notes the verse at
  // the top of the screen and how far down the screen it sits, and the page that loads next puts it
  // back. Keeping that distance, rather than aligning the verse to the top, is what lets bible.com's
  // sticky chrome go unmeasured: whatever covers the top of the page covers it on both sides of the
  // swap.
  //
  // sessionStorage and not chrome.storage.sync, because this belongs to one tab and one navigation
  // and must not spend sync's write quota. Every access is in a try, because a page with storage
  // blocked throws, and remembering a position must never get in the way of the swap itself.
  const SWAP_POSITION_KEY = 'bb-swap-position';
  // How long after a swap the position is held. It has to outlast a slow load and bible.com applying
  // the reader's settings, and it is a judgement of those and not a measurement.
  const SWAP_POSITION_MAX_AGE_MS = 15000;
  let swapPosition = null;
  let swapPositionLanded = false;

  function clearStoredSwapPosition() {
    try { sessionStorage.removeItem(SWAP_POSITION_KEY); } catch { /* blocked, so nothing was kept */ }
  }

  function forgetSwapPosition() {
    swapPosition = null;
    clearStoredSwapPosition();
  }

  // Read once, as this file loads, so that the many passes through refresh() in the life of a page
  // cost one comparison and not a storage read each. JSON.parse(null) is null, which is the ordinary
  // case of there being nothing to restore.
  try {
    swapPosition = JSON.parse(sessionStorage.getItem(SWAP_POSITION_KEY));
  } catch {
    forgetSwapPosition();
  }

  // The position is held for a while after the restore, so the moment the reader moves the page
  // themselves it has to let go, or the next pass would drag them back. The dock is excepted, because
  // pressing the swap button is not the reader moving the page, and letting go there would throw away
  // the very position stashSwapPosition is about to reuse.
  if (swapPosition) {
    const letGo = (e) => { if (!e.target.closest?.('[data-bb-own]')) forgetSwapPosition(); };
    for (const type of ['wheel', 'touchstart', 'keydown', 'mousedown']) {
      window.addEventListener(type, letGo, { capture: true, passive: true });
    }
  }

  // Walks firstSpans, which is in document order, and stops at the first verse whose top is on
  // screen, so this reads one verse's layout per verse scrolled past and is not a measuring pass.
  // At the very top of the page there is nothing to keep: the next page starts there anyway.
  //
  // A position still being held means the reader has not moved since the last swap, so this swap is
  // asked to keep that same place and it is reused rather than measured again. That is what stops
  // repeated swaps creeping: a measurement carries whatever error the page has at that moment into
  // the next page, where the next one adds to it. Before this, with Footnotes off, verse 6 of Exodus
  // 13 climbed 19px on every swap.
  function stashSwapPosition() {
    try {
      const loc = parseUrl();
      const write = (position) => sessionStorage.setItem(SWAP_POSITION_KEY, JSON.stringify({ ...position, at: Date.now() }));
      if (swapPosition?.ref === loc.ref) return write(swapPosition);
      if (!window.scrollY) return;
      for (const [usfm, el] of firstSpans(columnOf(loc.id))) {
        const offset = topOf(el);
        if (offset < 0) continue;
        return write({ ref: loc.ref, vid: loc.id, usfm, offset });
      }
    } catch (err) {
      console.debug('[BibleBoost] could not note the reading position', err);
    }
  }

  // Called at the end of every refresh(), after align() has set the gaps a verse's position depends
  // on. Until there is something to scroll to it simply returns, and the next schedule() tries again,
  // which is why this needs no timer of its own.
  //
  // It keeps correcting after the first time, because the first time is too early to be the last. The
  // server's HTML knows nothing of the reader's settings, so bible.com applies them after hydration:
  // measured 2026-11-10 with the footnotes=false cookie, the server sent every note as _note whatever
  // the cookie said, the page changed them to _hide about 400 ms after the restore, and the text above
  // verse 6 of Exodus 13 came out 19px shorter. Those changes reach here through the observer like any
  // other.
  //
  // The stored copy goes on the first success, so a reload does not come back to this verse, and only
  // then. A later pass that cleared it too could land between the click on the swap button and the
  // page unloading, and delete the position that click has just written.
  //
  // Less than a pixel is left alone, because the browser snaps a scroll to whole pixels and would
  // otherwise be asked for the same fraction on every pass.
  //
  // ready, because until the stored settings arrive align() is running on the defaults, and for a
  // reader with alignment off those gaps are about to disappear. columns(), because alignment needs
  // both columns and the second one arriving would move the verse.
  //
  // The verse is looked up in the column of the version it was read from, wherever that is now. A
  // swap changes the sides and not the versions, so it is still there. Looking in the new left column
  // would miss a verse that one version combines and the other does not, as CEV does with
  // ROM.1.3+ROM.1.4.
  //
  // 'instant' and not the default, which would defer to any scroll-behavior the page sets, and the
  // reader should not watch the chapter go past. The document is what scrolls (02-verse-dom.md).
  function restoreSwapPosition() {
    if (!swapPosition || !ready) return;
    const { ref, vid, usfm, offset, at } = swapPosition;
    // Written so that an entry with no usable time counts as expired: NaN < anything is false.
    if (parseUrl()?.ref !== ref || !(Date.now() - at < SWAP_POSITION_MAX_AGE_MS)) {
      forgetSwapPosition();
      return;
    }
    if (!columns()) return;
    const col = columnOf(vid);
    const verse = col && firstSpans(col).get(usfm);
    if (!verse) return;
    if (!swapPositionLanded) {
      swapPositionLanded = true;
      clearStoredSwapPosition();
    }
    const drift = topOf(verse) - offset;
    if (Math.abs(drift) >= 1) window.scrollBy({ top: drift, behavior: 'instant' });
  }

  // ---------- On-page switch ----------
  // The dock sits over the text the whole time it is on screen, so it stays collapsed to the
  // shortcut letter until it is hovered or focused, and only then spells the label out. Both
  // labels are hidden from assistive tech; aria-label carries the real name either way.
  const span = (cls, text) => {
    const el = document.createElement('span');
    el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  // Built as DOM nodes rather than an HTML string. Every value here is a literal today, so an
  // innerHTML version was not actually injectable, but textContent keeps it that way for free if a
  // label ever starts coming from storage or from the page.
  function switchEl(key, short, label, on, title) {
    const btn = document.createElement('button');
    btn.className = 'bb-sw';
    btn.dataset.sw = key;
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', String(on));
    btn.setAttribute('aria-label', label);
    btn.title = title;

    const track = span('bb-track');
    track.append(span('bb-thumb'));

    const lab = span('bb-label');
    lab.setAttribute('aria-hidden', 'true');
    lab.append(span('bb-short', short), span('bb-full', label));

    btn.append(track, lab);
    return btn;
  }

  // Two opposing arrows, the mark translation apps use for trading two languages, which is exactly
  // what this does. The geometry is Tabler Icons' arrows-exchange (MIT), copied exactly, because
  // that is the drawing the user picked from a mock on 2026-11-10. A hand-drawn lookalike with full
  // arrowheads went in first and was rejected as not being it, so do not tidy these paths.
  //
  // An inline SVG and not the character, whose weight and size would follow whichever fallback font
  // each machine picks. createElementNS because createElement('svg') makes an HTML element that
  // happens to be called svg, and that draws nothing. Paint is in content.css.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SWAP_ARROWS = ['M7 10h14l-4 -4', 'M17 14h-14l4 4'];

  function swapIcon() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of SWAP_ARROWS) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  // A plain button and not one more switch. role="switch" announces on or off, and neither reading
  // order is "on". It carries data-sw only so that the dock's one click listener can reach it.
  function swapEl() {
    const btn = document.createElement('button');
    btn.className = 'bb-swap';
    btn.dataset.sw = 'swap';
    btn.setAttribute('aria-label', 'Swap sides');
    btn.title = 'Swap the left and right versions';
    btn.append(swapIcon());
    return btn;
  }

  function renderDock() {
    const loc = parseUrl();
    let dock = document.getElementById('bb-dock');
    if (!settings.showSwitch || !loc) { dock?.remove(); return; }
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'bb-dock';
      // On the root only: the observer guard walks up with closest(), so everything renderDock()
      // later puts inside inherits this, and the switches it rebuilds need no marker of their own.
      dock.setAttribute('data-bb-own', '');
      dock.addEventListener('click', (e) => {
        const sw = e.target.closest('[data-sw]')?.dataset.sw;
        if (sw === 'parallel') setParallel(!parseUrl()?.parallel);
        if (sw === 'align') save({ align: !settings.align });
        if (sw === 'swap') swapSides();
      });
    }
    if (!dock.isConnected) document.body.appendChild(dock);
    // Every value rendered below must appear here, or the cache serves a stale switch.
    // Separators are deliberately not on the dock — they live in the popup and on Alt+S — so
    // settings.separators is not part of this key.
    //
    // canSwap is not the same fact as loc.parallel: a book intro or a ?parallel= repeating the id
    // has the parameter and nothing to trade. swappedUrl is the one place that decides that.
    const canSwap = swappedUrl(location.href) !== null;
    const state = `${!!loc.parallel}|${settings.align}|${canSwap}`;
    if (dock.dataset.state === state) return;
    dock.dataset.state = state;
    dock.replaceChildren(
      switchEl('parallel', 'P', 'Parallel', !!loc.parallel, 'Toggle parallel mode (Alt+P)'),
      ...(loc.parallel
        ? [switchEl('align', 'A', 'Align verses', settings.align, 'Line up verses side by side (Alt+A)')]
        : []),
      ...(canSwap ? [swapEl()] : []),
    );
  }

  // ---------- Settings ----------
  function save(patch) {
    settings = { ...settings, ...patch };
    if (store) store.set(patch);
    refresh();
  }

  function refresh() {
    renderDock();
    align();
    restoreSwapPosition();
    // Last, so that a bug in the panel can never cost the reader their alignment. This is the panel's
    // one way of hearing about client-side navigation, because 01-urls-and-routing.md says to hook
    // schedule() and not to add another polling loop. Through ?. because this file runs before that one.
    BB.panel?.refresh();
  }

  // ---------- Keep in sync with navigation, re-renders, font/size changes ----------
  // Set to true to log every schedule() call, including the ones the throttle below then swallows.
  // It stays in the committed code, off, because it is the acceptance test for T-004 and for every
  // later task that adds page DOM: whether a piece of UI re-runs align() can only be answered by
  // watching this log while using it. console.log and not console.debug on purpose. Chrome's
  // default console level hides debug output, and the passing result here is silence, so a hidden
  // log would look exactly like a working guard.
  const DEBUG_SCHEDULE = false;

  let timer = null;
  // Only the MutationObserver callback passes a number. schedule is also handed directly to
  // ResizeObserver, which passes an entries array, and to addEventListener, which passes an Event,
  // so reading .length here would report resize entries as if they were mutation records.
  const schedule = (recordCount) => {
    if (DEBUG_SCHEDULE) {
      console.log('[BibleBoost] schedule:', typeof recordCount === 'number' ? `${recordCount} record(s)` : 'not a mutation');
    }
    if (timer) return;
    timer = setTimeout(() => { timer = null; requestAnimationFrame(() => { remember(); refresh(); }); }, 80);
  };

  // Persist what the reader is looking at, so the popup can reopen it later.
  //
  // This runs on every schedule() tick, and the MutationObserver below can fire several times a
  // second while bible.com re-classes nodes on hover and verse selection. chrome.storage.sync
  // allows roughly 120 writes a minute and then starts failing silently, so this must write only
  // when something has genuinely changed.
  //
  // It also must NOT call save(): schedule() already calls refresh() on the next line, and
  // store.set() additionally fires the storage.onChanged listener below.
  function remember() {
    if (!ready) return;
    const loc = parseUrl();
    if (!loc) return;

    const patch = {};

    // The chapter is tracked on ANY reading page, not only a parallel one: if you wander off into
    // a single version, "Open parallel reading" should still bring you back to where you actually
    // were. loc.ref is null on book-intro pages, which have no parallel view at all, so those are
    // skipped rather than stored as a ref the Open URL could not use.
    if (loc.ref && loc.ref !== settings.lastRef) patch.lastRef = loc.ref;

    // The pair, by contrast, only means anything while two columns are actually on screen. A URL
    // whose ?parallel= repeats its own version id renders one column, so treat that as not a pair
    // either — storing it would leave both sides equal and disable the Open button.
    if (loc.parallel && loc.parallel !== loc.id) {
      if (loc.id !== settings.primaryId) patch.primaryId = loc.id;
      if (loc.parallel !== settings.parallelId) patch.parallelId = loc.parallel;
    }

    if (!Object.keys(patch).length) return;

    settings = { ...settings, ...patch };
    // Deliberately not save(): schedule() calls refresh() on the very next line, and store.set()
    // additionally fires the onChanged listener above. The callback reads runtime.lastError purely
    // to mark it as handled, so a hit write quota fails quietly instead of filling the console.
    store?.set(patch, () => void chrome.runtime.lastError);
  }

  // Every observer fire ends in align(), which queries every verse in both columns and forces a
  // synchronous layout per verse, deliberately, because each gap shifts what follows it. That was
  // safe by accident for as long as this extension only wrote data-* and inline style, neither of
  // which the observer watches. Anything that adds or removes ELEMENTS breaks that invariant, and
  // the symptom would be a sluggish reader while a note is being typed, which looks like a panel
  // problem and not an observer problem. So everything BibleBoost inserts carries data-bb-own, and
  // a batch made up only of our own changes is dropped before it costs a pass.
  //
  // Text nodes have no closest(), hence the step up to parentElement.
  function isOurs(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return !!el?.closest('[data-bb-own]');
  }

  // A record is ours when its target is ours, or when it changed nodes and every one of them is.
  //
  // The target is checked first because it is the only evidence left about a removed node. By the
  // time this callback runs, a removed node is already detached, so closest() cannot reach the
  // marked parent it came from: div.textContent = 'x' removes a text node whose parentElement is
  // now null, and dock.replaceChildren() removes switches with no marker of their own. Testing
  // those nodes instead of the target reads as "not ours" and costs a pass for nothing.
  //
  // The second half covers a marked root added to or removed from a bible.com parent, such as a
  // chip on body or a row in the verse menu. closest() starts at the element itself, so it finds
  // the marker even once the root is detached. If one of those ever does shift the text, the
  // ResizeObserver on the columns still catches it.
  //
  // The length check keeps alignment alive: a class change has no changed nodes, [].every() is
  // true, and without it every class bible.com touches would count as ours.
  function recordIsOurs(r) {
    if (isOurs(r.target)) return true;
    const changed = [...r.addedNodes, ...r.removedNodes];
    return changed.length > 0 && changed.every(isOurs);
  }

  // childList: chapter navigation / version change. class: bible.com settings & verse selection.
  // Deliberately still the whole body rather than just the columns: chapter navigation, version
  // changes and bible.com's own re-renders can happen anywhere in it. One record that is not ours
  // keeps the whole batch, and every() stops at it, so bible.com's own storms of re-classing
  // usually cost a single check.
  new MutationObserver((records) => {
    if (records.every(recordIsOurs)) return;
    schedule(records.length);
    // T-008 learns bible.com's selection class from these same records, which is how it manages
    // without a second body-wide observer. It comes after schedule() so that a bug in capture can
    // never cost the reader their alignment.
    BB.capture?.noteMutations(records);
  }).observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
  });
  window.addEventListener('resize', schedule);
  window.addEventListener('popstate', schedule);
  document.fonts?.addEventListener?.('loadingdone', schedule);
  let lastHref = location.href;
  setInterval(() => { if (location.href !== lastHref) { lastHref = location.href; schedule(); } }, 400);

  // Reader font-size changes (bible.com "Aa") change column height without DOM changes
  const ro = new ResizeObserver(schedule);
  let observedCols = [];
  setInterval(() => {
    const cols = columnEls();
    if (cols.length === observedCols.length && cols.every((c, i) => c === observedCols[i])) return;
    ro.disconnect();
    cols.forEach((c) => ro.observe(c));
    observedCols = cols;
  }, 1000);

  // ---------- Shortcuts ----------
  // Each shortcut is a named command that can be triggered from two places. The main one, since
  // B-006, is Chrome's own shortcut system: manifest "commands" -> background.js -> a 'command'
  // message, handled below. That route exists because on 2026-11-08 Alt+P / Alt+A / Alt+S did
  // nothing in a real Chrome on Windows while the dock switches, which call this same code,
  // worked. A key Chrome has bound to a command is caught by Chrome before the page sees it, so
  // nothing bible.com does can swallow it, and the user can rebind it at
  // chrome://extensions/shortcuts.
  //
  // The keydown listener stays as the fallback for when Chrome could not assign a suggested key
  // because something else already holds it. The two should never both fire for one key press,
  // because Chrome does not pass a bound command key on to the page. B-006's acceptance checks that
  // Alt+A toggles once and not twice, since a double toggle would look exactly like "nothing
  // happened".
  //
  // Each command returns true when it actually did something, so keydown only cancels a key it
  // used. Alt+A on a single-version page is left alone for whatever else wants it, exactly as the
  // inline conditions here used to do.
  const COMMANDS = {
    'toggle-parallel': () => { setParallel(!parseUrl()?.parallel); return true; },
    'toggle-align': () => {
      if (!parseUrl()?.parallel) return false;
      save({ align: !settings.align });
      return true;
    },
    'toggle-separators': () => {
      if (!parseUrl()?.parallel || !settings.align) return false;
      save({ separators: !settings.separators });
      return true;
    },
    // Not in the manifest's commands. Chrome allows four suggested keys and T-029 has the last of them.
    // quickbar.js runs after this file, so it is looked for at the moment of the press. Nothing selected
    // still counts as using the key, because it answers with a hint (T-015 R4). Only a quickbar.js that
    // failed to load leaves the key alone.
    'save-selection': () => { BB.quickbar?.save(); return !!BB.quickbar; },
  };

  // Keyboard fallback: Alt+P parallel, Alt+A alignment, Alt+S separators. Alt+N is not a fallback: this
  // listener is its only route (T-015 R2), so it shares the guard below for nothing extra, and the guard
  // is what stops it firing while somebody types in the notes panel.
  const KEY_COMMANDS = { KeyP: 'toggle-parallel', KeyA: 'toggle-align', KeyS: 'toggle-separators', KeyN: 'save-selection' };
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const run = COMMANDS[KEY_COMMANDS[e.code]];
    if (run && run()) e.preventDefault();
  });

  // The popup is the only thing that can reach this listener, so msg.url is not attacker-supplied
  // today. It is still the one place where a value from outside this file goes straight into
  // location.assign(), so it is worth gating: neither a future sender nor a bug in the popup's
  // buildUrl() should be able to navigate the reader off bible.com.
  //
  // The content script only ever runs on https://www.bible.com/*, which is the same set of pages
  // this should be willing to send the reader to.
  function isOwnSiteUrl(raw) {
    // Resolve against the current page so a relative path is judged on what it would become,
    // then check the ORIGIN rather than the href: hostname alone would accept http:, and a
    // substring test would accept "www.bible.com.evil.test".
    try {
      const u = new URL(raw, location.href);
      return u.protocol === 'https:' && u.hostname === 'www.bible.com';
    } catch {
      return false; // not a URL at all
    }
  }

  // Messages from the toolbar popup
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
      // A reply to 'state' is also how the popup learns this tab IS bible.com (the content script
      // runs nowhere else), which saves it needing the "tabs" permission to read tab.url.
      if (msg?.type === 'state') reply({ parallel: !!parseUrl()?.parallel });
      if (msg?.type === 'setParallel') { setParallel(!!msg.on); reply({ ok: true }); }
      if (msg?.type === 'go') {
        if (isOwnSiteUrl(msg.url)) { location.assign(msg.url); reply({ ok: true }); }
        else reply({ ok: false, error: 'refused: not a bible.com URL' });
      }
      // A shortcut from Chrome's own shortcut system, relayed by background.js. ok is false for an
      // unknown name, or for one that did not apply here, such as Alt+A on a single-version page.
      if (msg?.type === 'command') reply({ ok: !!COMMANDS[msg.command]?.() });
      // Deliberately synchronous: returning nothing keeps the reply channel valid.
    });
  }

  // ---------- Init ----------
  if (store) {
    store.get(DEFAULTS, (s) => { settings = { ...DEFAULTS, ...s }; ready = true; remember(); refresh(); });
    // Only the keys that change what is on screen are worth a re-render; the remembered ids and
    // ref are read lazily, at the moment they are needed.
    const VISUAL = new Set(['align', 'separators', 'showSwitch']);
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const [k, { newValue }] of Object.entries(changes)) settings[k] = newValue ?? DEFAULTS[k];
      if (Object.keys(changes).some((k) => VISUAL.has(k))) refresh();
    });
  } else {
    refresh();
  }
})();
