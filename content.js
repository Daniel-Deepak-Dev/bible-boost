(() => {
  /*
   * BibleBoost — parallel reading
   * Keeps bible.com's own verse DOM (so tap-to-highlight / copy / share / notes keep working)
   * and only adds vertical spacing before verses so verse N starts on the same line in both columns.
   */
  const DEFAULTS = { align: true, parallelId: '114', showSwitch: true };
  const store = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) || null;
  let settings = { ...DEFAULTS };
  const html = document.documentElement;

  // ---------- URL ----------
  // /bible/339/EXO.13.TAOVBSI?parallel=114
  function parseUrl(href = location.href) {
    const u = new URL(href);
    const m = u.pathname.match(/\/bible\/(\d+)\/([^/?#]+)/);
    if (!m) return null;
    const par = u.searchParams.get('parallel');
    return { id: m[1], parallel: par && /^\d+$/.test(par) ? par : null };
  }

  // ---------- Alignment ----------
  function columns() {
    const cols = [...document.querySelectorAll('.version[class*="vid"]')]
      .filter((c) => c.getClientRects().length); // bible.com hides the 2nd column on narrow screens
    return cols.length >= 2 ? cols.slice(0, 2) : null;
  }

  // verse number -> first element of that verse (a verse can be split across paragraphs)
  function firstSpans(col) {
    const map = new Map();
    col.querySelectorAll('[class*="_verse"][data-usfm]').forEach((el) => {
      // "EXO.13.4" or combined "EXO.13.1+EXO.13.2" -> key on the first number
      const n = parseInt(el.getAttribute('data-usfm').split('+')[0].split('.').pop(), 10);
      if (!isNaN(n) && !map.has(n)) map.set(n, el);
    });
    return map;
  }

  function topOf(el) {
    const label = el.querySelector('[class*="_label"]');
    const rects = (label || el).getClientRects();
    return rects.length ? rects[rects.length - 1].top : el.getBoundingClientRect().top;
  }

  let marked = new Set();

  function clearAlign() {
    html.removeAttribute('data-bb-align');
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

    // Reset, then walk verses top to bottom. Each gap only shifts what comes after it,
    // so one pass aligns everything.
    html.setAttribute('data-bb-align', '');
    marked.forEach((el) => { el.setAttribute('data-bb-v', ''); el.style.setProperty('--bb-gap', '0px'); });
    const nums = [...A.keys()].filter((n) => B.has(n)).sort((a, b) => a - b);
    for (const n of nums) {
      const a = A.get(n), b = B.get(n);
      const d = Math.round(topOf(b) - topOf(a));
      if (d === 0) continue;
      (d > 0 ? a : b).style.setProperty('--bb-gap', Math.abs(d) + 'px');
    }
  }

  // ---------- Parallel on/off ----------
  function setParallel(on) {
    const loc = parseUrl();
    if (!loc || on === !!loc.parallel) return;
    if (!on) {
      save({ parallelId: loc.parallel });
      // Prefer bible.com's own (client-side) exit link
      const exit = [...document.querySelectorAll('a[aria-label="Exit Parallel Mode"]')].find((a) => a.offsetParent);
      if (exit) return exit.click();
      const u = new URL(location.href);
      u.searchParams.delete('parallel');
      location.assign(u.toString());
    } else {
      const u = new URL(location.href);
      u.searchParams.set('parallel', settings.parallelId || DEFAULTS.parallelId);
      location.assign(u.toString());
    }
  }

  // ---------- On-page switch ----------
  function switchHtml(key, label, on, title) {
    return `<button class="bb-sw" data-sw="${key}" role="switch" aria-checked="${on}" title="${title}">
      <span class="bb-track"><span class="bb-thumb"></span></span><span>${label}</span></button>`;
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
    const state = `${!!loc.parallel}|${settings.align}`;
    if (dock.dataset.state === state) return;
    dock.dataset.state = state;
    dock.innerHTML =
      switchHtml('parallel', 'Parallel', !!loc.parallel, 'Toggle parallel mode (Alt+P)') +
      (loc.parallel ? switchHtml('align', 'Align verses', settings.align, 'Line up verses side by side (Alt+A)') : '');
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
    timer = setTimeout(() => { timer = null; requestAnimationFrame(() => { rememberParallel(); refresh(); }); }, 80);
  };

  function rememberParallel() {
    const p = parseUrl()?.parallel;
    if (p && p !== settings.parallelId) save({ parallelId: p });
  }

  // childList: chapter navigation / version change. class: bible.com settings & verse selection.
  // (Our own changes are data-* and style attributes, which are not observed → no feedback loop.)
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
    const cols = [...document.querySelectorAll('.version[class*="vid"]')];
    if (cols.length === observedCols.length && cols.every((c, i) => c === observedCols[i])) return;
    ro.disconnect();
    cols.forEach((c) => ro.observe(c));
    observedCols = cols;
  }, 1000);

  // Keyboard: Alt+P toggles parallel, Alt+A toggles alignment
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.code === 'KeyP') { e.preventDefault(); setParallel(!parseUrl()?.parallel); }
    if (e.code === 'KeyA' && parseUrl()?.parallel) { e.preventDefault(); save({ align: !settings.align }); }
  });

  // Messages from the toolbar popup
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
      if (msg?.type === 'state') reply({ parallel: !!parseUrl()?.parallel });
      if (msg?.type === 'setParallel') { setParallel(!!msg.on); reply({ ok: true }); }
    });
  }

  // ---------- Init ----------
  if (store) {
    store.get(DEFAULTS, (s) => { settings = { ...DEFAULTS, ...s }; rememberParallel(); refresh(); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const [k, { newValue }] of Object.entries(changes)) settings[k] = newValue ?? DEFAULTS[k];
      refresh();
    });
  } else {
    refresh();
  }
})();
