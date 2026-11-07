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
    separators: true,
    primaryId: '111',
    parallelId: '114',
    lastRef: 'JHN.1',
    showSwitch: true,
  };
  const store = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) || null;
  let settings = { ...DEFAULTS };
  let ready = !store; // never persist anything until the stored settings have actually loaded
  const html = document.documentElement;

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

  // ---------- Alignment ----------
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

  function topOf(el) {
    const label = verseLabel(el);
    const rects = (label || el).getClientRects();
    if (!rects.length) return el.getBoundingClientRect().top;
    // The label is a single rect. Without one, use the verse's FIRST line, not its last.
    return (label ? rects[rects.length - 1] : rects[0]).top;
  }

  // bible.com puts section headings (USFM \s1) in their own block before the paragraph they head.
  // A rule there would cut a heading off from its own first verse.
  function afterHeading(el) {
    const block = el.closest('[class*="_p"], [class*="_q"], [class*="_li"]');
    if (!block) return false;
    // A paragraph holds several verses, and it often OPENS with the tail of the previous one, so
    // the verse that sits against the heading is the first one in the block that actually starts.
    const first = [...block.querySelectorAll('[class*="_verse"][data-usfm]')].find(verseLabel);
    if (first !== el) return false;
    const prev = block.previousElementSibling;
    return !!prev && /_s\d/.test(prev.getAttribute('class') || '');
  }

  let marked = new Set();
  let markedCols = [];

  function clearAlign() {
    html.removeAttribute('data-bb-align');
    html.removeAttribute('data-bb-sep');
    markedCols.forEach((c) => c.removeAttribute('data-bb-col'));
    markedCols = [];
    marked.forEach((el) => { el.removeAttribute('data-bb-v'); el.style.removeProperty('--bb-gap'); });
    marked = new Set();
  }

  function align() {
    const loc = parseUrl();
    const cols = settings.align && loc && loc.parallel ? columns() : null;
    if (!cols) return clearAlign();

    const [A, B] = cols.map(firstSpans);
    const next = new Set([...A.values(), ...B.values()]);
    marked.forEach((el) => { if (!next.has(el)) { el.removeAttribute('data-bb-v'); el.style.removeProperty('--bb-gap'); } });
    marked = next;

    // Verses present in BOTH columns, in document order.
    const keys = [...A.keys()].filter((k) => B.has(k));

    // A separator is drawn above its verse, so skip the first (no rule under the chapter heading)
    // and skip any verse that opens a section (no rule between a heading and its own first verse).
    // Both columns are decided together so the two sides stay symmetric.
    const sep = new Set();
    if (settings.separators) {
      for (let i = 1; i < keys.length; i++) {
        const a = A.get(keys[i]), b = B.get(keys[i]);
        if (afterHeading(a) || afterHeading(b)) continue;
        sep.add(a); sep.add(b);
      }
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
    });

    // Walk verses top to bottom. Each gap only shifts what comes after it, so one pass aligns
    // everything; reading topOf() forces the layout the previous gap just invalidated.
    for (const k of keys) {
      const a = A.get(k), b = B.get(k);
      const d = Math.round(topOf(b) - topOf(a));
      if (d === 0) continue;
      (d > 0 ? a : b).style.setProperty('--bb-gap', Math.abs(d) + 'px');
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

  // ---------- On-page switch ----------
  // The dock sits over the text the whole time it is on screen, so it stays collapsed to the
  // shortcut letter until it is hovered or focused, and only then spells the label out. Both
  // labels are hidden from assistive tech; aria-label carries the real name either way.
  function switchHtml(key, short, label, on, title) {
    return `<button class="bb-sw" data-sw="${key}" role="switch" aria-checked="${on}" aria-label="${label}" title="${title}">
      <span class="bb-track"><span class="bb-thumb"></span></span>
      <span class="bb-label" aria-hidden="true"><span class="bb-short">${short}</span><span class="bb-full">${label}</span></span>
    </button>`;
  }

  function renderDock() {
    const loc = parseUrl();
    let dock = document.getElementById('bb-dock');
    if (!settings.showSwitch || !loc) { dock?.remove(); return; }
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'bb-dock';
      dock.addEventListener('click', (e) => {
        const sw = e.target.closest('[data-sw]')?.dataset.sw;
        if (sw === 'parallel') setParallel(!parseUrl()?.parallel);
        if (sw === 'align') save({ align: !settings.align });
      });
    }
    if (!dock.isConnected) document.body.appendChild(dock);
    // Every value rendered below must appear here, or the cache serves a stale switch.
    // Separators are deliberately not on the dock — they live in the popup and on Alt+S — so
    // settings.separators is not part of this key.
    const state = `${!!loc.parallel}|${settings.align}`;
    if (dock.dataset.state === state) return;
    dock.dataset.state = state;
    dock.innerHTML =
      switchHtml('parallel', 'P', 'Parallel', !!loc.parallel, 'Toggle parallel mode (Alt+P)') +
      (loc.parallel ? switchHtml('align', 'A', 'Align verses', settings.align, 'Line up verses side by side (Alt+A)') : '');
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
  }

  // ---------- Keep in sync with navigation, re-renders, font/size changes ----------
  let timer = null;
  const schedule = () => {
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

  // childList: chapter navigation / version change. class: bible.com settings & verse selection.
  // (Our own changes are data-* and style attributes, which are not observed -> no feedback loop.)
  new MutationObserver(schedule).observe(document.body, {
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

  // Keyboard: Alt+P parallel, Alt+A alignment, Alt+S separators
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.code === 'KeyP') { e.preventDefault(); setParallel(!parseUrl()?.parallel); }
    if (e.code === 'KeyA' && parseUrl()?.parallel) { e.preventDefault(); save({ align: !settings.align }); }
    if (e.code === 'KeyS' && parseUrl()?.parallel && settings.align) { e.preventDefault(); save({ separators: !settings.separators }); }
  });

  // Messages from the toolbar popup
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
      // A reply to 'state' is also how the popup learns this tab IS bible.com (the content script
      // runs nowhere else), which saves it needing the "tabs" permission to read tab.url.
      if (msg?.type === 'state') reply({ parallel: !!parseUrl()?.parallel });
      if (msg?.type === 'setParallel') { setParallel(!!msg.on); reply({ ok: true }); }
      if (msg?.type === 'go') { location.assign(msg.url); reply({ ok: true }); }
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
