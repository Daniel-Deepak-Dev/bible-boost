/*
 * BibleBoost — the side panel's page
 * The frame panel-host.js opens on bible.com (T-017): its pin (T-018), the page's theme (T-020), the
 * note list (T-021), editing, creating and trashing notes in it (T-022), and listing the chapter on
 * screen first (T-023).
 *
 * This page cannot see bible.com. Anything page-shaped comes from src/content/panel-host.js by
 * postMessage, and the table of those messages is in work/understandings/extension/03-messaging.md.
 * Notes never go that way: the list and the editor ask the service worker themselves, through
 * src/ui/app/store.js.
 */
import { createList, NEW_ROW } from './app/list.js';
import { createEditor } from './app/editor.js';
import { createToasts } from './app/toast.js';
import { moveToTrash, offerUndo } from './app/trash.js';
import { chooseDialog } from './app/dialog.js';
import { ask, onNotesChange } from './app/store.js';
import {
  DEFAULT_SCOPE, bookOf, chapterName, cleanLabel, cleanRef, cleanScope, createScopeControl,
  effectiveScope, emptyText, filterFor, inFilter, sameFilter,
} from './app/scope.js';

// The one page this can be framed in that means anything. Only www, because that is the only host the
// content script matches.
const HOST_ORIGIN = 'https://www.bible.com';

// Narrows the sender down, and does not prove who it is. panel-host.js runs inside bible.com's tab, so
// its messages carry bible.com's origin, which is exactly what the page's own scripts carry too, and
// nothing here can tell those two apart. That is why nothing arriving this way may ever cause a write.
//
// What this does rule out is every other site, by origin, and any frame embedded in the page, by
// source: such a frame can be served from bible.com too, so it can pass the origin test on its own.
// The origin is compared whole, because a substring test would accept www.bible.com.evil.test.
function isFromHost(event) {
  return event.origin === HOST_ORIGIN && event.source === window.parent;
}

const pin = document.getElementById('bb-pin');

// Open is written where DevTools can read it, because this shell shows nothing else yet, and that is
// how the round trip through the host gets checked.
//
// pinned is the stored choice, and canPin is whether the window is wide enough to act on it. The host
// has to say the second, because a media query in here measures this frame, which is 30% of a wide
// window and so reads as narrow there too. A pin the window cannot honour is still shown as pressed
// whenever the window is wide again, because the choice was kept.
//
// The name stays the same whichever way the pin is, and aria-pressed is what says which way that is.
// Only the tooltip says what a click will do. None of this is a write, so it is fit to come from this
// channel: a page script posting its own state can only change what the button shows.
const HANDLERS = {
  state(msg) {
    document.documentElement.dataset.bbOpen = String(!!msg.open);
    const pinned = !!msg.pinned;
    pin.setAttribute('aria-pressed', String(pinned));
    pin.title = pinned ? 'Pinned beside the page. Click to float over it' : 'Pin beside the page';
    pin.hidden = !msg.canPin;
  },

  // bible.com's light or dark, from panel-host.js (T-020). The same class the page itself uses, on this
  // document's <html>, because theme.css matches html.light and html.dark and nothing else: a data-theme
  // attribute would leave the panel following the OS. Only the two known values, and the other one
  // comes off, so a page script posting nonsense can at worst pick one of the two palettes.
  theme(msg) {
    if (msg.theme !== 'light' && msg.theme !== 'dark') return;
    const root = document.documentElement;
    root.classList.remove(msg.theme === 'dark' ? 'light' : 'dark');
    root.classList.add(msg.theme);
  },

  // The chapter on screen, from panel-host.js (T-023 R4). Checked here and not trusted: a page script
  // can post one too, and the most it can then do is show the user a different chapter of their own
  // notes. Nothing it sends is written anywhere. versions is not read yet.
  context(msg) {
    onContext({ ref: cleanRef(msg.ref), label: cleanLabel(msg.label) });
  },
};

// Own-property only, so that { bb: 'constructor' } finds nothing.
window.addEventListener('message', (e) => {
  if (!isFromHost(e)) return;
  const type = e.data?.bb;
  if (typeof type === 'string' && Object.hasOwn(HANDLERS, type)) HANDLERS[type](e.data);
});

// Whatever goes up this channel also reaches bible.com's own scripts, because a message posted to the
// top window is delivered to every listener on it. So no note text ever goes this way.
const send = (msg) => window.parent.postMessage(msg, HOST_ORIGIN);

document.getElementById('bb-close').addEventListener('click', () => send({ bb: 'close' }));

// The button is not flipped here. The host answers every pin it accepts with a state message, and that
// is the only thing that changes the button, so it cannot show a pin the host refused or never got.
pin.addEventListener('click', () => {
  send({ bb: 'pin', pinned: pin.getAttribute('aria-pressed') !== 'true' });
});

// After the listener above, so that it already exists when the host answers, and before the list, so
// that nothing the list does can keep the × and the pin from working.
send({ bb: 'ready' });

// ---------- Notes ----------
// One editor at a time, open inside the row of the note it edits (T-022 R1), or in a row of its own at
// the top for a note being written (R4). editor is that editor, or null.
//
// Nothing is stored until the editor's Save (R2 as amended, 2026-11-12), so every way of leaving an editor
// that has changes on it asks first, and the editor does the asking: see close() in editor.js.
//
// Opening, closing and trashing all wait their turn in one queue. Each can wait on the user, since
// leaving an editor with changes asks what to do with them, and a second click arriving meanwhile must
// not open a second editor over the first.
let editor = null;
let queue = Promise.resolve();
const serial = (job) => (queue = queue.then(job).catch((err) => console.error('[BibleBoost] panel:', err)));

// The row about to be opened, so that as the open row above it shrinks back, this one stays under the
// pointer that just clicked it.
let keepId = null;

// A note that closes by being saved has moved to the top, as the newest, and its row is highlighted
// there so that it can be seen what was updated (decided with the user, 2026-11-12). A new note's row
// becomes the stored note's row first.
//
// A note written here has no verse (T-022 R4), so it is in no chapter and no book, and with either scope
// on it leaves the list the moment it is saved. The toast says where it went, and takes the user there.
//
// The chapter may have changed while the editor was open (T-023 R6). Its closing is "when they finish",
// so the list follows the page now, behind whatever else is in the queue: when the editor closed because
// another note is opening, that note's editor is open by the time this runs, and the list waits again.
function startEditor(note) {
  const ed = createEditor({
    note,
    source: 'panel',
    lookups: list.lookups,
    onClose: ({ focus, saved }) => {
      if (editor === ed) editor = null;
      if (saved && list.openId === NEW_ROW) list.adopt(saved.id);
      list.collapse({ focus, keep: keepId, flash: !!saved });
      if (saved && !note && shown && !inFilter(saved, shown.filter)) {
        toasts.show({ message: 'Saved under All, as it has no verse.', action: { label: 'Show', run: () => choose('all') } });
      }
      if (pending) serial(follow);
    },
  });
  editor = ed;
  return ed;
}

// Resolves to false if the user chose to keep editing, when the editor asked what to do with changes.
// how is the editor's: 'ask' offers Save, Discard and Keep editing.
async function closeEditor({ focus = false, keep = null, how = 'ask' } = {}) {
  if (!editor) return true;
  keepId = keep;
  try {
    return await editor.close({ focus, how });
  } finally {
    keepId = null;
  }
}

// Enter on a row or a click on it. On the row already open it only puts the caret back in the note: the
// row of a new note has no note of its own to pass, and an open one passes the note being edited.
function onOpen(note) {
  return serial(async () => {
    if (editor && (!note || note.id === editor.id)) return editor.focus();
    if (!note || !(await closeEditor({ keep: note.id }))) return;
    const ed = startEditor(note);
    if (list.open(note.id, ed.el)) ed.focus();
    else await ed.close({ focus: false });
  });
}

// R4: the + in the header. A note already being written keeps its place, and gets the caret back.
function newNote() {
  return serial(async () => {
    if (editor && list.openId === NEW_ROW) return editor.focus();
    if (!(await closeEditor())) return;
    const ed = startEditor(null);
    list.openNew(ed.el);
    ed.focus();
  });
}

// The row's trash button and Delete, and bbPanel.trash from the Console (R5, R7). The open note's editor
// closes first and drops any unsaved change: the note goes to Trash as it was last saved, and that is
// what Undo brings back. A new note that was never saved has nothing to trash: closing it is its delete,
// and asks first if it has words in it.
function onTrash(ids) {
  return serial(async () => {
    let wanted = [...ids];
    const ed = editor;
    if (ed && wanted.includes(list.openId)) {
      if (!(await ed.close({ focus: false, how: ed.id ? 'discard' : 'cancel' }))) return false;
      wanted = wanted.filter((id) => id !== NEW_ROW);
      if (ed.id && !wanted.includes(ed.id)) wanted.push(ed.id);
    }
    const done = wanted.length ? await moveToTrash(wanted, { toasts, list }) : false;
    if (!document.activeElement || document.activeElement === document.body) list.focus();
    return done;
  });
}

// The open note was trashed or purged in another tab or surface. With nothing unsaved the editor just
// closes. With changes on screen the user chooses: keep them, saved into the note in Trash (the worker
// accepts an update there), so that Undo brings the note back with them; or drop them. A note still in
// Trash can be brought back from the toast; a purged one cannot, and the toast says only what happened.
function onGone(id) {
  return serial(async () => {
    if (!editor || editor.id !== id) return;
    let how = 'discard';
    if (editor.dirty) {
      how = await chooseDialog({
        title: 'This note was moved to Trash elsewhere',
        message: 'Keep your unsaved changes in it, so that Undo brings it back with them?',
        choices: [{ value: 'discard', label: 'Discard them', kind: 'danger' }, { value: 'save', label: 'Keep them', kind: 'primary' }],
        cancel: 'save',
      });
    }
    await editor.close({ focus: true, how });
    const reply = await ask({ type: 'notes/get', id });
    if (reply.ok && reply.note) offerUndo([id], 'This note was moved to Trash elsewhere', { toasts, list });
    else toasts.show({ message: 'This note was deleted elsewhere' });
  });
}

document.getElementById('bb-new').addEventListener('click', newNote);

// ---------- Scope (T-023) ----------
// The panel opens on the chapter being read, because the three notes that matter right now should not
// be hunted for among all of them. The notes page will list everything; this is what makes the panel
// part of reading rather than an archive.
//
// scope is the user's choice, from storage.local (R7), and context is the chapter on screen as the host
// last said (R4). Both are null until they are known, and the list asks for nothing until both are, so
// it never shows every note for a moment before the chapter's.
//
// shown is what the list is showing, { scope, ref, label, filter }, where scope is what the user chose
// unless the page has no chapter (R9). pending is true while the page has moved to another chapter and
// an open editor holds the list where it was (R6).
//
// panelScope sits in storage.local beside the host's panelOpen, panelPinned and panelWidth, and for the
// same reason: it is how this device's panel was left, not a setting that should follow the user.
const SCOPE_KEY = 'panelScope';

// The host answers 'ready' with the chapter at once. If it never does, as with the panel opened on its
// own for a test, the panel stops waiting and lists everything, as on a page with no chapter.
const CONTEXT_WAIT_MS = 1000;

// A bulk change arrives as several signals in a row, and each would recount all three scopes.
const COUNT_SETTLE_MS = 50;

let scope = null;
let context = null;
let shown = null;
let pending = false;

const reading = document.getElementById('bb-reading');
const readingText = reading.querySelector('.bb-reading-text');
const scopeControl = createScopeControl(document.getElementById('bb-scope'), { onChoose: choose });

// The chapter the counts and the control speak of: while the list waits, the one it is still showing, so
// that the numbers agree with the rows under them; otherwise the one on screen.
const here = () => (pending ? shown : context) ?? { ref: null, label: null };

function paintScope() {
  const { ref, label } = here();
  scopeControl.set({ shown: shown?.scope ?? effectiveScope(scope ?? DEFAULT_SCOPE, ref), ref, label, counts: counted.ref === ref ? counts : { all: counts.all } });
}

// R6's line under the header. A page with no chapter has nothing to name, and still changes the list,
// to All.
function setPending(on) {
  pending = on;
  reading.hidden = !on;
  if (on) {
    readingText.textContent = context.ref ? `Now reading ${chapterName(context.ref, context.label)}` : 'Now on a page with no chapter';
  }
}

// ---------- Counts ----------
// R3: how many notes each scope holds, so that "Chap 0" beside "Book 12" says the chapter is empty, and
// not that the panel is broken. Three asks of limit 0, which the worker answers with the total alone
// (schema.js, cleanPage): the chapter's and the book's from byVerse, All's from two index counts.
//
// Asked again on every change to the notes and every move to another chapter. The generation drops an
// answer overtaken by a later question, and counted is the chapter they were asked for, so a count
// is never drawn against a chapter it is not about: until the new ones arrive, Chap and Book show none.
let counts = { chapter: null, book: null, all: null };
let counted = { ref: undefined };
let countGen = 0;
let countTimer = 0;

function recount() {
  clearTimeout(countTimer);
  countTimer = setTimeout(countNow, COUNT_SETTLE_MS);
}

async function countNow() {
  const gen = ++countGen;
  const { ref } = here();
  const total = async (filter) => {
    const reply = await ask({ type: 'notes/list', filter, page: { offset: 0, limit: 0 } });
    return reply.ok ? reply.total : null;
  };
  const [chapter, book, all] = await Promise.all([
    ref ? total({ chapter: ref }) : null,
    ref ? total({ book: bookOf(ref) }) : null,
    total({}),
  ]);
  if (gen !== countGen) return;
  counts = { chapter, book, all };
  counted = { ref };
  paintScope();
  if (shown && shown.ref === ref) list.setEmpty(emptyText(shown.scope, shown.ref, shown.label, counts));
}

// ---------- Following the page ----------
// Puts the list on the chapter on screen, in the user's scope. Only with no editor open: every caller
// either has none or has just closed it.
function show() {
  const { ref, label } = context;
  const filter = filterFor(scope, ref);
  shown = { scope: effectiveScope(scope, ref), ref, label, filter };
  setPending(false);
  list.setFilter(filter, { empty: emptyText(shown.scope, ref, label, counted.ref === ref ? counts : {}) });
  paintScope();
  recount();
}

// The list starts the first time both the scope and the chapter are known, whichever comes second.
function start() {
  if (shown || scope === null || context === null) return;
  show();
}

// R5, after a client-side move to another chapter, and whenever an editor closes with the list held.
//
// All is the user's own choice of everything, and it is left alone. The chapter and the book follow the
// page, and a move inside one book changes nothing in book scope but the name. With an editor open the
// list stays as it is (R6), with the line under the header to say the page has moved on, and its Show
// to go there now.
async function follow() {
  if (!shown) return;
  if (scope === 'all') {
    paintScope();
    return;
  }
  const filter = filterFor(scope, context.ref);
  if (sameFilter(filter, shown.filter)) {
    shown = { ...shown, scope: effectiveScope(scope, context.ref), ref: context.ref, label: context.label };
    setPending(false);
    list.setEmpty(emptyText(shown.scope, shown.ref, shown.label, counted.ref === shown.ref ? counts : {}));
    paintScope();
    return;
  }
  if (editor) {
    setPending(true);
    paintScope();
    return;
  }
  show();
}

function onContext(next) {
  clearTimeout(contextTimer);
  const moved = next.ref !== context?.ref;
  context = next;
  if (moved) paintScope();
  recount();
  if (!shown) start();
  else serial(follow);
}

const contextTimer = setTimeout(() => {
  if (context === null) onContext({ ref: null, label: null });
}, CONTEXT_WAIT_MS);

// R2, from the control. The open editor closes first, asking about any changes (T-022's note on this
// task): a note from another chapter left open over a new list would confuse, and Keep editing leaves
// the scope as it was. Choosing the scope already shown, while the list is held, is the same as Show.
//
// Written to storage only when it changes (AGENTS.md rule 8), and only from here, never because of a
// message from the page.
function choose(next) {
  return serial(async () => {
    if (!shown || (next === scope && !pending)) return;
    if (!(await closeEditor())) return;
    if (next !== scope) {
      scope = next;
      remember(next);
    }
    show();
  });
}

function remember(value) {
  try {
    chrome.storage.local.set({ [SCOPE_KEY]: value }, () => void chrome.runtime.lastError);
  } catch (err) {
    console.debug('[BibleBoost] panel: could not remember the scope', err);
  }
}

reading.querySelector('button').addEventListener('click', () => serial(async () => {
  if (await closeEditor()) await follow();
}));

// R7. A choice that cannot be read is the default, and the list still starts.
try {
  chrome.storage.local.get({ [SCOPE_KEY]: DEFAULT_SCOPE }, (got) => {
    scope = cleanScope(chrome.runtime.lastError ? DEFAULT_SCOPE : got[SCOPE_KEY]);
    start();
  });
} catch (err) {
  console.debug('[BibleBoost] panel: could not read the scope', err);
  scope = DEFAULT_SCOPE;
}

// The list fills <main>, and the toasts sit under it, in the flow, so that they shorten the list
// rather than cover its last row (R6).
//
// The handle on globalThis is for the console, as save-popover.js keeps BB.savePopover.debug: in the
// panel's own frame (right-click inside it, Inspect), bbPanel.list.stats says how many rows the DOM
// holds, bbPanel.list.setFilter({ tag: 'x' }) shows a filter the panel has no control for yet,
// bbPanel.trash([...ids]) trashes several notes at once the way T-027's selection will (decided with the
// user, 2026-11-12), and bbPanel.scope says what the list is showing and what the counts are (T-023).
// Nothing outside this frame can reach it: the page that frames the panel is another origin.
//
// filter: null, so the list waits for the scope and the chapter (T-023) before it asks for anything.
const list = createList(document.querySelector('main'), { onOpen, onTrash, onGone, filter: null });
const toasts = createToasts(document.body, { onFocusLost: () => list.focus() });
onNotesChange(recount);
globalThis.bbPanel = {
  list,
  trash: onTrash,
  get scope() { return { chosen: scope, shown, context, pending, counts: { ...counts, for: counted.ref } }; },
};
