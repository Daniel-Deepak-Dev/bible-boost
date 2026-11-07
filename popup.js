const DEFAULTS = { align: true, parallelId: '114', showSwitch: true };
const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(DEFAULTS, (s) => {
  $('align').checked = s.align;
  $('showSwitch').checked = s.showSwitch;
  const known = [...$('version').options].some((o) => o.value === s.parallelId);
  $('version').value = known ? s.parallelId : 'custom';
  if (!known) { $('custom').style.display = 'block'; $('custom').value = s.parallelId; }
});

$('align').onchange = (e) => chrome.storage.sync.set({ align: e.target.checked });
$('showSwitch').onchange = (e) => chrome.storage.sync.set({ showSwitch: e.target.checked });

$('version').onchange = (e) => {
  const v = e.target.value;
  $('custom').style.display = v === 'custom' ? 'block' : 'none';
  if (v !== 'custom') chrome.storage.sync.set({ parallelId: v });
  else $('custom').focus();
};

$('custom').onchange = (e) => {
  const raw = e.target.value.trim();
  const m = raw.match(/[?&]parallel=(\d+)/) || raw.match(/\/bible\/(\d+)/) || raw.match(/^(\d+)$/);
  if (m) { e.target.style.borderColor = ''; chrome.storage.sync.set({ parallelId: m[1] }); }
  else e.target.style.borderColor = '#d33';
};

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
