/*
 * BibleBoost — service worker
 * Three separate entry points, which should stay separate:
 *
 * - chrome.commands: the Parallel / Align / Separators keyboard shortcuts, passed on to the tab that
 *   was in front when the key was pressed (B-006).
 * - chrome.runtime.onMessage: the message router (T-002). The panel, the notes page and the content
 *   script ask the worker for data this way, and the worker is the only IndexedDB client
 *   (architecture rule 1). The popup does NOT come through here: it talks to the content script
 *   with chrome.tabs.sendMessage, which never reaches the worker.
 * - chrome.runtime.onInstalled: creates or upgrades the database as soon as the extension is
 *   installed or updated (T-003).
 *
 * Why the shortcuts come through here at all (B-006): on 2026-11-08 Alt+P / Alt+A / Alt+S did
 * nothing in a real Chrome on Windows, while the dock switches, which run the very same code,
 * worked. bible.com was shown not to swallow the keys, and the cause was never pinned down. A key
 * declared in the manifest's "commands" is caught by Chrome itself, before the page sees it, so
 * nothing the page does can get in the way. It also lets the user rebind it at
 * chrome://extensions/shortcuts without touching code.
 *
 * Nothing is held in module scope that a restart could lose. Chrome stops this worker after ~30 s
 * idle and starts it again for the next event (T-002 R8). HANDLERS below is code, not state: it is
 * rebuilt identically on every start.
 */
import { SCHEMA_VERSION } from './src/shared/schema.js';
import { dispatch } from './src/background/router.js';
import { openDb } from './src/background/db.js';
import {
  createNote, getNote, updateNote, listNotes, trashNotes, restoreNotes, purgeNotes,
  listTopics, createTopic, updateTopic, deleteTopic, topicCounts,
  listTags, renameTag, mergeTags, deleteTag,
} from './src/background/repo.js';

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

// ---------- Install ----------
// Opens the database once, as soon as the extension is installed or updated, which creates it or
// runs any new step of the ladder before the first note needs it. Nothing is waiting on this open,
// so a failure has only the worker's console to go to. The next handler that needs the database
// gets the same error back through the router.
//
// Registered at the top level for the same reason as the message listener below: this is the event
// that started the worker, and a listener added any later would miss it.
chrome.runtime.onInstalled.addListener(() => {
  openDb().catch((err) => console.error('[BibleBoost] could not open the notes database:', err));
});

// ---------- Message router ----------
// One entry per message type, namespaced 'area/verb' as catalogued in
// work/understandings/extension/03-messaging.md. Every handler is async and resolves to a plain
// object. dispatch() in router.js does the lookup, and the reply rules live there.
//
// ping exists so the worker can be smoke-tested before any data handler does:
//   await chrome.runtime.sendMessage({ type: 'ping' })   // from any extension page's console
//
// The data handlers do nothing but unpack the message and shape the reply. Validation, ids and the
// change signal all belong to repo.js (T-005), so a handler has nothing to get wrong. A throw from
// repo.js becomes { ok: false, error } in dispatch().
const HANDLERS = Object.freeze({
  ping: async () => ({ ok: true, schemaVersion: SCHEMA_VERSION }),

  'notes/create': async ({ draft }) => ({ ok: true, note: await createNote(draft) }),
  'notes/update': async ({ id, patch }) => ({ ok: true, note: await updateNote(id, patch) }),
  'notes/get': async ({ id }) => ({ ok: true, note: await getNote(id) }),
  'notes/list': async ({ filter, sort, page }) => ({ ok: true, ...(await listNotes({ filter, sort, page })) }),
  'notes/trash': async ({ ids }) => ({ ok: true, ...(await trashNotes(ids)) }),
  'notes/restore': async ({ ids }) => ({ ok: true, ...(await restoreNotes(ids)) }),
  'notes/purge': async ({ ids }) => ({ ok: true, ...(await purgeNotes(ids)) }),

  'topics/list': async () => ({ ok: true, topics: await listTopics() }),
  'topics/create': async ({ name, color, parentId }) => ({ ok: true, topic: await createTopic({ name, color, parentId }) }),
  'topics/update': async ({ id, patch }) => ({ ok: true, topic: await updateTopic(id, patch) }),
  'topics/delete': async ({ id, strategy }) => ({ ok: true, ...(await deleteTopic(id, strategy)) }),
  'topics/counts': async () => ({ ok: true, counts: await topicCounts() }),

  'tags/list': async () => ({ ok: true, tags: await listTags() }),
  'tags/rename': async ({ from, to }) => ({ ok: true, ...(await renameTag(from, to)) }),
  'tags/merge': async ({ from, into }) => ({ ok: true, ...(await mergeTags(from, into)) }),
  'tags/delete': async ({ name }) => ({ ok: true, ...(await deleteTag(name)) }),
});

// Deliberately NOT an async function, unlike every handler. The documented way to keep the reply
// channel open is for the listener to return literally true. An async listener returns a Promise
// instead, and on a Chrome that does not treat a returned Promise as the reply, the channel closes
// at once and the caller's sendMessage resolves to undefined. Returning true works on every version.
// content.js's listener can return nothing only because it replies before it returns.
//
// Registered synchronously, at the top level. When a message wakes a stopped worker, Chrome
// delivers it to the listeners that exist once this file has finished its first run. One added
// later, after an await, say, misses the very message that started the worker.
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  dispatch(HANDLERS, msg).then(reply);
  return true;
});
