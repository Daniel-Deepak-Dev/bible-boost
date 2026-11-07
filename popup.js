// Keep in sync with content.js. chrome.storage.sync.get(DEFAULTS) fills in whatever a profile is
// missing, so an older install picks these up without a migration step.
const DEFAULTS = {
  align: true,
  separators: true,
  primaryId: '111',
  parallelId: '114',
  lastRef: 'JHN.1',
  showSwitch: true,
};
const $ = (id) => document.getElementById(id);

const VERSIONS = [
  ['114', 'NKJV — New King James'],
  ['1', 'KJV — King James'],
  ['111', 'NIV'],
  ['59', 'ESV'],
  ['100', 'NASB1995'],
  ['116', 'NLT'],
  ['339', 'TAOVBSI — Tamil O.V. (BSI)'],
];

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
  sel.innerHTML = VERSIONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')
    + '<option value="custom">Other (bible.com ID or URL)…</option>';

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
    const known = VERSIONS.some(([v]) => v === id);
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

// Parallel mode acts on the current bible.com tab
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const off = () => { $('parallelRow').classList.add('disabled'); $('parallelNote').textContent = '(open a bible.com chapter)'; };
  if (!tab) return off();
  chrome.tabs.sendMessage(tab.id, { type: 'state' }, (res) => {
    if (chrome.runtime.lastError || !res) return off();
    $('parallel').checked = res.parallel;
    $('parallel').onchange = (e) => {
      chrome.tabs.sendMessage(tab.id, { type: 'setParallel', on: e.target.checked });
      window.close();
    };
  });
});
