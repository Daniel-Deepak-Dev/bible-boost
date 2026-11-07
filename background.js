/*
 * BibleBoost — service worker
 * Today this does one thing: it receives the Parallel / Align / Separators keyboard shortcuts from
 * Chrome and passes them to the tab that was in front when the key was pressed. T-002 adds the
 * message router and the data layer next to it. That router serves chrome.runtime.sendMessage, and
 * this listener serves chrome.commands; they are separate entry points and should stay separate.
 *
 * Why the shortcuts come through here at all (B-006): on 2026-11-08 Alt+P / Alt+A / Alt+S did
 * nothing in a real Chrome on Windows, while the dock switches, which run the very same code,
 * worked. bible.com was shown not to swallow the keys, and the cause was never pinned down. A key
 * declared in the manifest's "commands" is caught by Chrome itself, before the page sees it, so
 * nothing the page does can get in the way. It also lets the user rebind it at
 * chrome://extensions/shortcuts without touching code.
 *
 * Nothing is held in module scope. Chrome stops this worker after ~30 s idle and starts it again
 * for the next key press, so there must be nothing here that a restart could lose (T-002 R8).
 */

// ---------- Keyboard shortcuts ----------
// The command names are declared in manifest.json "commands", and content.js maps the same names
// to actions in its COMMANDS table. Chrome hands over the active tab of the focused window. On any
// tab that is not bible.com no content script is listening, so sendMessage fails with "Receiving
// end does not exist". Reading lastError marks that as expected instead of logging it on every
// stray key press.
chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'command', command }, () => void chrome.runtime.lastError);
});
