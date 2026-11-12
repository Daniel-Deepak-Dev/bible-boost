/*
 * BibleBoost — the side panel's page
 * The frame panel-host.js opens on bible.com (T-017): its pin (T-018), the page's theme (T-020), the
 * note list (T-021), and editing, creating and trashing notes in it (T-022).
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
import { ask } from './app/store.js';

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
function startEditor(note) {
  const ed = createEditor({
    note,
    source: 'panel',
    lookups: list.lookups,
    onClose: ({ focus, saved }) => {
      if (editor === ed) editor = null;
      if (saved && list.openId === NEW_ROW) list.adopt(saved.id);
      list.collapse({ focus, keep: keepId, flash: !!saved });
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

// The list fills <main>, and the toasts sit under it, in the flow, so that they shorten the list
// rather than cover its last row (R6).
//
// The handle on globalThis is for the console, as save-popover.js keeps BB.savePopover.debug: in the
// panel's own frame (right-click inside it, Inspect), bbPanel.list.stats says how many rows the DOM
// holds, bbPanel.list.setFilter({ tag: 'x' }) shows the filtered empty state before T-023 gives the
// panel a filter of its own, and bbPanel.trash([...ids]) trashes several notes at once the way T-027's
// selection will (decided with the user, 2026-11-12). Nothing outside this frame can reach it: the page
// that frames the panel is another origin.
const list = createList(document.querySelector('main'), { onOpen, onTrash, onGone });
const toasts = createToasts(document.body, { onFocusLost: () => list.focus() });
globalThis.bbPanel = { list, trash: onTrash };
