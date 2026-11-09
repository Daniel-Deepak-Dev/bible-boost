import { VERSIONS } from './src/shared/refs.js';

// Keep in sync with content.js. chrome.storage.sync.get(DEFAULTS) fills in whatever a profile is
// missing, so an older install picks these up without a migration step.
const DEFAULTS = {
  align: true,
  separators: false,
  primaryId: '111',
  parallelId: '114',
  lastRef: 'JHN.1',
  showSwitch: true,
};
const $ = (id) => document.getElementById(id);

let state = { ...DEFAULTS };

// Accepts a bare id, a /bible/<id> URL, or a ?parallel=<id> URL. A full parallel URL carries BOTH
// ids, so each field looks for its own one first — otherwise pasting a parallel URL into the left
// field would store the right-hand version.
function parseVersionId(raw, preferParallel) {
  const s = String(raw).trim();
  const order = preferParallel
    ? [/[?&]parallel=(\d+)/, /\/bible\/(\d+)/]
    : [/\/bible\/(\d+)/, /[?&]parallel=(\d+)/];
  for (const re of [...order, /^(\d+)$/]) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

// Wires a <select> + its "Other…" text input to one storage key. Returns a function that displays
// a stored id in the pair.
function bindVersionField(selectId, customId, key, preferParallel) {
  const sel = $(selectId), custom = $(customId);
  // new Option() sets textContent, so a label can never be parsed as markup.
  sel.replaceChildren(
    ...[...VERSIONS].map(([id, { name }]) => new Option(name, id)),
    new Option('Other (bible.com ID or URL)…', 'custom'),
  );

  const commit = (id) => {
    state[key] = id;
    chrome.storage.sync.set({ [key]: id });
    refreshOpen();
  };

  sel.onchange = () => {
    if (sel.value === 'custom') { custom.style.display = 'block'; custom.focus(); return; }
    custom.style.display = 'none';
    commit(sel.value);
  };

  custom.onchange = () => {
    const id = parseVersionId(custom.value, preferParallel);
    custom.style.borderColor = id ? '' : '#d33';
    if (id) commit(id);
  };

  return (id) => {
    const known = VERSIONS.has(id);
    sel.value = known ? id : 'custom';
    custom.style.display = known ? 'none' : 'block';
    if (!known) custom.value = id;
  };
}

const showLeft = bindVersionField('leftVersion', 'leftCustom', 'primaryId', false);
const showRight = bindVersionField('rightVersion', 'rightCustom', 'parallelId', true);

function buildUrl() {
  // Guard a stored ref that is empty or not a chapter, so the URL can never come out malformed.
  const ref = /^[A-Z0-9]{3}\.\d+$/.test(state.lastRef || '') ? state.lastRef : DEFAULTS.lastRef;
  const base = `https://www.bible.com/bible/${state.primaryId}/${ref}`;
  // bible.com collapses to one column when the two ids match. A readable single column beats a
  // parallel view that silently isn't one.
  return state.primaryId === state.parallelId ? base : `${base}?parallel=${state.parallelId}`;
}

function refreshOpen() {
  const same = state.primaryId === state.parallelId;
  $('open').disabled = same;
  $('openNote').textContent = same
    ? 'Pick two different versions — bible.com shows one column when they match.'
    : `Opens ${(state.lastRef || DEFAULTS.lastRef).replace('.', ' ')} with both versions.`;
}

$('open').onclick = () => {
  const url = buildUrl();
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) { chrome.tabs.create({ url }); return window.close(); }
    // The content script runs on bible.com and nowhere else, so a reply here IS the proof that the
    // active tab is bible.com — no "tabs" permission needed to read tab.url. No reply means it is
    // some other page (or a bible.com tab opened before the extension loaded), so open a new one.
    chrome.tabs.sendMessage(tab.id, { type: 'go', url }, () => {
      if (chrome.runtime.lastError) chrome.tabs.create({ url });
      window.close();
    });
  });
};

for (const key of ['align', 'separators', 'showSwitch']) {
  $(key).onchange = (e) => {
    state[key] = e.target.checked;
    chrome.storage.sync.set({ [key]: e.target.checked });
  };
}

chrome.storage.sync.get(DEFAULTS, (s) => {
  state = { ...DEFAULTS, ...s };
  $('align').checked = state.align;
  $('separators').checked = state.separators;
  $('showSwitch').checked = state.showSwitch;
  showLeft(state.primaryId);
  showRight(state.parallelId);
  refreshOpen();
});

// ---------- Parallel mode ----------
// Acts on the current bible.com tab. A reply to 'state' proves the tab is bible.com, but silence
// does not prove it isn't, because a bible.com tab is silent in two other situations (B-007):
//
// - It is still loading. Content scripts run at document_idle, so every page load has a window with
//   nothing listening yet. Asking again closes that one by itself, which is why the row can come
//   back here instead of staying grey until the popup is closed and reopened.
// - It was already open when the extension was installed, updated or reloaded. Chrome does not
//   inject content scripts into a tab that is already open, so no amount of asking helps until that
//   tab is reloaded, which is what the note has to say. Without the tabs permission the popup cannot
//   tell this from "some other site", so the one note covers both.
//
// 20 tries at 500 ms gives up after 10 s, a guess at how long anyone waits on a popup rather than a
// measurement. Reading lastError on each failure marks it as expected, so the retries log nothing.
const STATE_TRIES = 20;
const STATE_RETRY_MS = 500;

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const off = () => { $('parallelRow').classList.add('disabled'); $('parallelNote').textContent = '(open or reload a bible.com chapter)'; };
  const on = () => { $('parallelRow').classList.remove('disabled'); $('parallelNote').textContent = ''; };
  if (!tab) return off();
  const ask = (triesLeft) => chrome.tabs.sendMessage(tab.id, { type: 'state' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      off();
      if (triesLeft > 1) setTimeout(ask, STATE_RETRY_MS, triesLeft - 1);
      return;
    }
    on();
    $('parallel').checked = res.parallel;
    $('parallel').onchange = (e) => {
      chrome.tabs.sendMessage(tab.id, { type: 'setParallel', on: e.target.checked });
      window.close();
    };
  });
  ask(STATE_TRIES);
});

// ---------- Durable storage ----------
// Asks Chrome not to evict this extension's data under disk pressure, and records the answer in
// storage.local for T-049 to show, because a refusal changes the real risk.
//
// It is here, and not in the service worker where T-003 R6 first put it, because persist() exists
// only on pages. In a worker navigator.storage.persisted() is a function and persist() is undefined
// (measured in Chromium 152, and the Storage spec marks it [Exposed=Window]). The popup is the only
// page this extension has so far, so this runs the first time the popup opens rather than at
// install. Until then unlimitedStorage is what exempts the database from eviction.
//
// Asked again on every open until it is granted, since Chrome answers without prompting and can
// change its mind. The comparison keeps a repeated refusal from rewriting the same record.
chrome.storage.local.get('persistence', ({ persistence }) => {
  if (persistence?.granted) return;
  navigator.storage.persist().then((granted) => {
    if (persistence?.granted !== granted) chrome.storage.local.set({ persistence: { granted, at: Date.now() } });
  });
});
