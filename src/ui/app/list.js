/*
 * BibleBoost — the note list
 * The panel's main view, and the list the notes page (EPIC-03) will import unchanged (T-021 R1). How
 * dense it is belongs to the host's stylesheet; what it does is decided here, once.
 *
 * The user's own words set the bar: "side panel should be compact as possible, dont make it look
 * overloaded." So a row at rest is four things and nothing else (R2): the topic's dot, the verse
 * reference, the tags, and two lines of the note. Delete appears on hover and on focus (R3). Open in
 * full page is not drawn yet, because what it opens is T-025's page, and a button that does nothing is
 * worse than none.
 *
 * Enter and a click call onOpen, and the host answers by handing the list an editor to show inside that
 * row (T-022 R1). The list's part is to make room for it: one row taller than the rest, kept where it
 * was while it is open whatever changes around it, and never taken out of the DOM
 * by the virtual window while somebody is typing in it.
 *
 * Everything is built with createElement and textContent (AGENTS.md rule 2): a note body is user
 * content, and it can arrive from an imported file.
 */
import { captionOf } from '../../shared/refs.js';
import { ask, loadLookups, onNotesChange } from './store.js';

// ---------- The preview ----------
// R5. The body's Markdown source, not its rendering: rendering every row's Markdown is wasted work for
// two lines, and source reads perfectly well at that length. What would read as noise is the syntax at
// the start of a line, so a heading's #, a quote's > and a list's marker come off, each line on its
// own, and the lines are run together as the two-line clamp will show them anyway.
//
// The quote comes off first so that "> # Title" loses both. \d is ASCII only, which is right here:
// a list marker is Markdown syntax, and Markdown numbers its lists in ASCII digits whatever the text.
//
// The body is cut at PREVIEW_MAX first, purely to keep a long note's text out of layout. Two lines of
// the widest panel, half of a 2560px window, hold about 400 characters, so the cut is never on screen
// and cannot split a Tamil letter where anyone could see it. The visible end is the clamp's (R6).
const PREVIEW_MAX = 1000;
const QUOTE_RE = /^\s{0,3}(?:>\s?)+/;
const HEADING_RE = /^\s{0,3}#{1,6}(?:\s+|$)/;
const LIST_RE = /^\s{0,3}(?:[-*+]|\d{1,9}[.)])(?:\s+(?:\[[ xX]\]\s+)?|$)/;

export function previewOf(body) {
  if (typeof body !== 'string' || !body) return '';
  return body.slice(0, PREVIEW_MAX).split(/\r?\n/)
    .map((line) => line.replace(QUOTE_RE, '').replace(HEADING_RE, '').replace(LIST_RE, '').trim())
    .filter(Boolean)
    .join(' ');
}

// ---------- Tunables ----------
// R7: below this many rows every one is in the DOM, which keeps the page's own Find and a screen
// reader's view of the list whole. Above it, only what is on screen plus BUFFER rows each way.
const VIRTUAL_FROM = 200;
const BUFFER = 8;

// Pages are fetched as the window nears them, newest first by updatedAt, which the worker answers
// from the byUpdated index with a cursor that keeps only the page (R8, 02-storage-model.md). The first
// page of 50 measured 2ms with about 2,000 notes.
const PAGE = 100;
const SORT = Object.freeze({ by: 'updatedAt', dir: 'desc' });

// R11. Most queries answer well inside this, and a skeleton that flashes up and away looks broken.
const LOADING_DELAY_MS = 150;

// The room above the first row, so its hover fill does not touch the header's rule. It is part of every
// row's position and of the spacer's height, and not a margin on the row, because a margin is not in
// the offsetHeight that the row's position and the scrolling arithmetic are both built from.
const INSET = 4;

// A page can be worked out after a write has committed and still reach the list before that write's
// change signal does: the worker publishes the signal through two storage calls after the commit, and
// the page's answer does not wait for them. Patching on top of such a page applies the change twice.
// A trash would then pull the next page's first note out of the list without a trace, and leave the
// total one short. So a change that arrives within this long after a page was taken in is not patched
// but reloaded, which is always right. The gap it covers is a few milliseconds; this is generous, and
// a page that came in seconds earlier, such as the first one, does not cost every later change a reload.
const OVERTAKE_MS = 500;

// R10, the two empty states. "Save to BibleBoost" is the menu row's own label (menu.js).
const EMPTY_NONE = 'No notes yet. Select a verse and choose Save to BibleBoost.';
const EMPTY_FILTERED = 'No notes match this filter.';

// Tabler Icons' "trash" (MIT), the same set as the panel's pin, stroked in currentColor.
const TRASH_PATHS = [
  'M4 7l16 0', 'M10 11l0 6', 'M14 11l0 6',
  'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12',
  'M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3',
];

const SVG_NS = 'http://www.w3.org/2000/svg';

// The key of the row a new note is written in before it exists (T-022 R4). Not a shape any note id can
// take, since every id the worker makes starts "n_" (schema.js, newId).
export const NEW_ROW = 'bb:new';

// How long a note restored by Undo may take to come back and still be given focus. Past this the user
// has moved on, and focus jumping to the list would be a surprise.
const FOCUS_WAIT_MS = 3000;

// How long a row just saved stays highlighted. ui.css fades it over the same time.
const FLASH_MS = 1600;

function make(tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

function icon(paths) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

// ---------- The list ----------
// host is the element the list fills. The hooks are the host's way in:
//   onOpen(note)   Enter on a row, or a click on one. The host opens its editor there with open(). For the
//                  row of a new note, which has no note yet, note is undefined.
//   onTrash(ids)   the row's trash button, and Delete on a row. The host trashes with its undo toast
//                  (T-022 R5). Without one, the list trashes by itself, as it did before T-022.
//   onGone(id)     the open note was trashed or purged somewhere else. Its row stays, editor and all,
//                  until the host has saved what is in it and called collapse().
//
// The model is three things: ids, the note id at each position of the sorted list, with holes where a
// page has not arrived; notes, each loaded note by id; and total, which the worker reports. The view is
// rows, the elements currently in the DOM, keyed by note id. A row is built once for its note and then
// only moved and repainted, never rebuilt, which is what lets an edit elsewhere touch one row (R9).
//
// Between the two sits the display order, which is the model's except for the open row (T-022). That is
// held after its anchor, the note that was above it when it opened, and the model is left as the worker
// sees it. So paging, patching and the reloads below are untouched by an editor being open, and the open
// row stays put even when a change from elsewhere makes its note the newest. Anchoring to a neighbour
// rather than to a position keeps it beside the same notes when one is created or trashed above it.
export function createList(host, { onOpen = () => {}, onTrash = null, onGone = () => {} } = {}) {
  const status = make('p', 'bb-list-status');
  status.setAttribute('role', 'status');
  status.hidden = true;

  // The rows are the list's own children, so that each listitem sits directly in its list. The spacer
  // is what gives the scroller its full height while only a window of rows exists.
  const scroller = make('div', 'bb-list');
  scroller.setAttribute('role', 'list');
  scroller.setAttribute('aria-label', 'Notes');
  scroller.hidden = true;
  const spacer = make('div', 'bb-list-spacer');
  spacer.setAttribute('aria-hidden', 'true');
  scroller.append(spacer);
  host.append(status, scroller);

  let filter = {};
  let ids = [];
  let total = null;
  let error = null;
  let emptyText = EMPTY_NONE;
  const notes = new Map();
  const rows = new Map();
  let lookups = { topics: new Map(), tags: new Map() };

  let rowHeight = 0;
  // The note that holds the list's one tab stop. An id and not a position, because positions move
  // under it: a note created elsewhere pushes every row down by one, and a position would then hand the
  // tab stop to the focused row's neighbour.
  let activeId = null;
  // A position to focus once its page arrives, after End or PageDown into the unloaded part of a long
  // list. Any change, reload or new filter cancels it, since the position it names may mean another
  // note by then.
  let pendingFocus = null;
  // A note to focus once it is back on the list, after an Undo. { id, until }, or null.
  let pendingFocusId = null;

  // The open row, or null: { id, el, row, anchor: { id, at }, extra, observer }. id is NEW_ROW while
  // the note is still being written. anchor.id is the note to sit after, null for "by position", and
  // anchor.at is that position, kept current so that a vanished anchor leaves the row where it was.
  // extra is how much taller than the others the row is, measured off it.
  let open = null;

  // Where the open row sits, worked out from the model by relayout() before anything positional reads it.
  //   d      its display index, -1 with nothing open
  //   m      its index in the model, -1 when its note is not there (a new note, or one gone elsewhere)
  //   extra  the open row's extra height
  //   count  how many rows the display has: total, plus the open row if the model does not have it
  let lay = { d: -1, m: -1, extra: 0, count: 0 };

  // A change from the worker shifts positions, and a page asked for before it would land on the wrong
  // ones. Each change starts a new generation, and a reply from an older one is dropped. fresh is the
  // pages answered in this generation, so a reload can leave the old rows on screen while it asks again.
  // failed is the pages that answered with an error, or with fewer notes than the total promised, in
  // this generation: they are not asked again until something changes, because asking again at once is
  // a loop, and a tight one when the extension has gone and every answer is an immediate error.
  let generation = 0;
  const pending = new Set();
  const fresh = new Set();
  const failed = new Set();
  let lastReplyAt = -Infinity;

  const filtering = () => Object.keys(filter).length > 0;

  // ---------- Status line ----------
  function say(text) {
    status.textContent = text;
    status.hidden = !text;
  }

  // ---------- Rows ----------
  // The parts are made once here and found again by class in paint(). Delete is the only action, and
  // its button is hidden by CSS until the row is hovered or holds focus, which also takes it out of
  // the tab order until then: a hidden element cannot take focus.
  function buildRow() {
    const row = make('div', 'bb-row');
    row.setAttribute('role', 'listitem');
    row.tabIndex = -1;
    const head = make('div', 'bb-row-head');
    const dot = make('span', 'bb-dot');
    dot.setAttribute('role', 'img');
    head.append(dot, make('span', 'bb-ref'), make('span', 'bb-tags'));
    const actions = make('div', 'bb-actions');
    const trashBtn = make('button', 'bb-act');
    trashBtn.type = 'button';
    trashBtn.dataset.bbAct = 'trash';
    trashBtn.setAttribute('aria-label', 'Move to Trash');
    trashBtn.title = 'Move to Trash (Delete)';
    trashBtn.append(icon(TRASH_PATHS));
    actions.append(trashBtn);
    row.append(head, make('p', 'bb-preview'), actions);
    return row;
  }

  // A topic's colour is free text in storage and can come from an import, so it is checked before it is
  // used. An invalid one draws the plain dot, as a topic with no colour does. Uncategorized is a ring,
  // so that it reads as "no topic" rather than as one more colour.
  function paintDot(dot, topicId) {
    const topic = topicId == null ? null : lookups.topics.get(topicId);
    const color = topic?.color && CSS.supports('color', topic.color) ? topic.color : '';
    dot.style.backgroundColor = color;
    dot.toggleAttribute('data-bb-none', topicId == null);
    const name = topicId == null ? 'Uncategorized' : (topic?.name ?? 'Topic');
    dot.title = name;
    dot.setAttribute('aria-label', `Topic: ${name}`);
  }

  // R4. captionOf, so that a three-verse note reads "யாத்திராகமம் 13:2-4" and not just its first verse.
  // A note with no verse at all, which T-022 lets the panel create, shows its title there instead.
  //
  // A note with a verse and a title shows both (decided with the user, 2026-11-12, after T-022 put a
  // title field in the panel and the title then appeared nowhere). The reference keeps the first line,
  // since it is what the list is scanned by, and the title starts the two-line preview in bold:
  // "Firstborn — Consecrate to Me…". So a row is still the same four things at the same fixed height, and
  // the clamp still decides where it ends. A note with no verse already shows its title as the
  // reference, and it is not said twice.
  //
  // A note with an empty body previews its verse, muted, because two blank lines say nothing and the
  // verse is what the note was saved against. A title stays in the full text colour in front of it.
  function paint(row, note) {
    row.dataset.id = note.id;
    paintDot(row.querySelector('.bb-dot'), note.topicId);
    const caption = captionOf(note.verses);
    const title = typeof note.title === 'string' ? note.title.trim() : '';
    row.querySelector('.bb-ref').textContent = caption || title || 'Note';
    row.querySelector('.bb-tags').replaceChildren(...(note.tags ?? []).map((name) => {
      const chip = make('span', 'bb-chip');
      chip.textContent = lookups.tags.get(name)?.label || name;
      return chip;
    }));
    const preview = row.querySelector('.bb-preview');
    const body = previewOf(note.body);
    const text = body || note.verses?.[0]?.primary?.text || '';
    if (caption && title) {
      const strong = make('strong', 'bb-title');
      strong.textContent = title;
      preview.replaceChildren(strong, text ? ` — ${text}` : '');
    } else {
      preview.textContent = text;
    }
    preview.toggleAttribute('data-bb-verse', !body);
  }

  // The row of a note still being written. It has no verse and no topic yet, so its head says what it is.
  function paintNew(row) {
    row.dataset.id = NEW_ROW;
    paintDot(row.querySelector('.bb-dot'), null);
    row.querySelector('.bb-ref').textContent = 'New note';
    row.querySelector('.bb-tags').replaceChildren();
    row.querySelector('.bb-preview').textContent = '';
  }

  // The height every row is given by ui.css, read off a real one rather than worked out, because it is
  // made of line heights and padding a host can change. Zero while the frame is not being laid out, as
  // when the panel is closed, in which case the next draw asks again.
  function measure() {
    const probe = buildRow();
    probe.style.visibility = 'hidden';
    scroller.append(probe);
    const h = probe.offsetHeight;
    probe.remove();
    return h;
  }

  // ---------- Loading ----------
  async function loadPage(offset) {
    pending.add(offset);
    const gen = generation;
    const reply = await ask({ type: 'notes/list', filter, sort: SORT, page: { offset, limit: PAGE } });
    if (gen !== generation) return;
    pending.delete(offset);
    if (!reply.ok) {
      error = reply.error;
      failed.add(offset);
      draw();
      return;
    }
    error = null;
    lastReplyAt = performance.now();
    fresh.add(offset);
    total = reply.total;
    ids.length = total;
    if (reply.notes.length < Math.min(PAGE, total - offset)) failed.add(offset);
    // An id this page brings that is still recorded at another position is from before some change,
    // and leaving it there would show one note twice.
    const arrived = new Set(reply.notes.map((n) => n.id));
    ids.forEach((id, i) => {
      if (arrived.has(id) && (i < offset || i >= offset + reply.notes.length)) delete ids[i];
    });
    reply.notes.forEach((note, i) => {
      ids[offset + i] = note.id;
      notes.set(note.id, note);
      const row = rows.get(note.id);
      if (row) paint(row, note);
    });
    if (lookupsLoaded && !reply.notes.every(known)) refreshLookups();
    if (total === 0) emptyText = await emptyMessage(gen);
    draw();
    if (pendingFocus !== null && pendingFocus < lay.count && idAt(pendingFocus) !== undefined) focusAt(pendingFocus);
    focusPending();
  }

  // R10. With a filter on, an empty list means nothing until it is known whether there are notes at
  // all. A page of limit 0 answers only the total, from index counts.
  async function emptyMessage(gen) {
    if (!filtering()) return EMPTY_NONE;
    const all = await ask({ type: 'notes/list', page: { offset: 0, limit: 0 } });
    if (gen !== generation) return emptyText;
    return all.ok && all.total === 0 ? EMPTY_NONE : EMPTY_FILTERED;
  }

  // Every page the window touches that has not been answered in this generation, or that has a hole
  // because a removal pulled later positions up into it, is asked for once.
  function ensureLoaded(from, to) {
    for (let p = Math.floor(from / PAGE) * PAGE; p < to; p += PAGE) {
      if (pending.has(p) || failed.has(p)) continue;
      let hole = !fresh.has(p);
      for (let i = p; !hole && i < Math.min(p + PAGE, total ?? 0); i += 1) hole = ids[i] === undefined;
      if (hole) loadPage(p);
    }
  }

  // Starts a new generation. Whatever was asked before is forgotten, along with what failed and where
  // focus was headed.
  function newGeneration() {
    generation += 1;
    pending.clear();
    failed.clear();
    pendingFocus = null;
  }

  // Asks again for what is on screen, leaving the rows there until the answers arrive so that the list
  // does not blink empty. With nothing on screen, an empty list or one whose first answer never came,
  // there is no window to ask for, so it asks for the first page directly: otherwise restoring the only
  // note would leave "No notes yet" showing over a list of one.
  function reload() {
    newGeneration();
    fresh.clear();
    if (total) draw();
    else loadPage(0);
  }

  // ---------- The display order ----------
  // Works out where the open row sits, from the model as it is now. Everything positional below reads
  // lay, so each entry point calls this first: draw(), focusAt() and anything the host calls.
  //
  // With its anchor in the model, the open row sits straight after it, counted without the open note's
  // own model slot, since that is wherever the last save put it. With no anchor (it opened at the top,
  // or the anchor's page is not loaded, or a filter emptied the model) it keeps its last position.
  function relayout() {
    const count = total ?? 0;
    if (!open) return (lay = { d: -1, m: -1, extra: 0, count });
    const m = ids.indexOf(open.id);
    const all = count + (m < 0 ? 1 : 0);
    const a = open.anchor.id === null ? -1 : ids.indexOf(open.anchor.id);
    let d = a >= 0 ? a - (m >= 0 && m < a ? 1 : 0) + 1 : open.anchor.at;
    d = Math.max(0, Math.min(d, all - 1));
    open.anchor.at = d;
    return (lay = { d, m, extra: open.extra, count: all });
  }

  // The note id at display index i, and back. Between the open row's model slot and its display slot,
  // every row is one off from its model index; everywhere else they agree.
  function idAt(i) {
    const { d, m } = lay;
    if (d < 0) return ids[i];
    if (i === d) return open.id;
    const j = i < d ? i : i - 1;
    return ids[m >= 0 && j >= m ? j + 1 : j];
  }

  function displayOf(k) {
    const { d, m } = lay;
    if (d < 0) return k;
    if (k === m) return d;
    const j = m >= 0 && k > m ? k - 1 : k;
    return j < d ? j : j + 1;
  }

  function displayIndexOf(id) {
    if (open && id === open.id) return lay.d;
    const k = ids.indexOf(id);
    return k < 0 ? -1 : displayOf(k);
  }

  // ---------- Drawing ----------
  // One row is taller while it is open, by lay.extra, and every row after it moves down by that much.
  const topOf = (i) => INSET + i * rowHeight + (lay.d >= 0 && i > lay.d ? lay.extra : 0);
  const heightAt = (i) => rowHeight + (i === lay.d ? lay.extra : 0);

  // The display index at a scroll offset: the inverse of topOf, stepping over the open row's extra.
  function indexAt(y) {
    const h = rowHeight || 1;
    const i = Math.floor((y - INSET) / h);
    if (lay.d < 0 || i <= lay.d) return i;
    return y < topOf(lay.d) + heightAt(lay.d) ? lay.d : Math.floor((y - INSET - lay.extra) / h);
  }

  function windowRange() {
    const { count } = lay;
    if (!count) return [0, 0];
    if (count <= VIRTUAL_FROM) return [0, count];
    const first = indexAt(scroller.scrollTop) - BUFFER;
    const last = indexAt(scroller.scrollTop + scroller.clientHeight) + 1 + BUFFER;
    return [Math.max(0, first), Math.min(count, last)];
  }

  function place(row, i) {
    row.style.top = `${topOf(i)}px`;
    row.setAttribute('aria-posinset', String(i + 1));
    row.setAttribute('aria-setsize', String(lay.count));
  }

  // The row holding focus is kept even when it has scrolled out of the window, so that focus is never
  // dropped onto the page under the user's keyboard. It is kept too while it is between two pages: a
  // reload answers page by page, and a note pushed from position 99 to 100 has left the first page's
  // answer before the second one has placed it. Only a note that is really gone, which remove() takes
  // out of notes, lets its focused row go.
  //
  // The open row is kept whatever happens, because it holds an editor and what is typed in it. Its
  // status line says nothing over a new note being written into an empty list.
  function draw() {
    // The open row's height is read again on every draw, and not only when the observer in hold() says
    // it changed. That observer is what moves the rows below as somebody types; this is so that a draw
    // for any other reason can never place them from a stale height. A ResizeObserver can be late or
    // silent: in the built-in browser with its pane hidden it never fired at all (T-022).
    if (open && rowHeight) open.extra = Math.max(0, open.row.offsetHeight - rowHeight);
    relayout();
    const { count } = lay;
    if (error) say(`Could not load notes. ${error}`);
    else if (total === 0) say(open ? '' : emptyText);
    else if (total !== null) say('');
    scroller.hidden = !count;
    if (!count) {
      for (const row of rows.values()) row.remove();
      rows.clear();
      return;
    }
    if (!rowHeight) rowHeight = measure();
    spacer.style.height = `${topOf(count)}px`;

    // Display and model indices differ by one at most, around the open row, so the model's window is the
    // display's widened by one each way.
    const [from, to] = windowRange();
    ensureLoaded(Math.max(0, from - 1), Math.min(total ?? 0, to + 1));

    const wanted = new Map();
    for (let i = from; i < to; i += 1) {
      const id = idAt(i);
      if (id !== undefined) wanted.set(id, i);
    }
    if (open) wanted.set(open.id, lay.d);
    let held = null;
    const focusedId = document.activeElement?.closest?.('.bb-row')?.dataset.id;
    if (focusedId && !wanted.has(focusedId)) {
      const at = displayIndexOf(focusedId);
      if (at >= 0) wanted.set(focusedId, at);
      else if (notes.has(focusedId)) held = focusedId;
    }

    for (const [id, row] of rows) {
      if (wanted.has(id) || id === held) continue;
      row.remove();
      rows.delete(id);
    }
    for (const [id, i] of wanted) {
      let row = rows.get(id);
      if (!row) {
        row = buildRow();
        paint(row, notes.get(id));
        rows.set(id, row);
        scroller.append(row);
      }
      place(row, i);
    }

    // One tab stop for the whole list. If the note that has it is not on screen, the first row that is
    // takes it, or Tab would skip the list altogether.
    const stop = rows.has(activeId) ? activeId : idAt(from);
    for (const [id, row] of rows) row.tabIndex = id === stop ? 0 : -1;
  }

  let drawFrame = 0;
  const drawSoon = () => {
    if (!drawFrame) drawFrame = requestAnimationFrame(() => { drawFrame = 0; draw(); });
  };
  scroller.addEventListener('scroll', drawSoon, { passive: true });
  new ResizeObserver(drawSoon).observe(scroller);

  // ---------- Focus and keys ----------
  const indexOfRow = (row) => {
    relayout();
    return displayIndexOf(row.dataset.id);
  };

  // Scrolls display index i into view, the top of it first when it is taller than the view, as the open
  // row can be.
  function reveal(i) {
    const top = topOf(i);
    const bottom = top + heightAt(i);
    if (top < scroller.scrollTop) scroller.scrollTop = top - INSET;
    else if (bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = Math.min(top - INSET, bottom - scroller.clientHeight);
    }
  }

  // The row is scrolled into view by hand, and drawn at once, so that it exists to be focused: in a
  // virtual list the next row down may not have been built yet.
  function focusAt(i) {
    relayout();
    if (!lay.count) return;
    const at = Math.max(0, Math.min(lay.count - 1, i));
    reveal(at);
    // The tab stop moves here and not only in the focusin listener below, because a page that is not
    // the window's focused one gets no focus events for focus() (seen with the panel's page hidden),
    // and the tab stop would then stay behind on the row the arrows started from.
    const id = idAt(at);
    if (id !== undefined) activeId = id;
    draw();
    const row = rows.get(idAt(at));
    if (!row) {
      pendingFocus = at;
      return;
    }
    pendingFocus = null;
    row.focus({ preventScroll: true });
  }

  // After an Undo, or a Save whose note the worker's signal has not placed yet: focus the note once it is
  // on the list, unless the user has gone on to something else in the meantime, which is anything with
  // focus but the page itself. flash highlights it as well, whatever has focus.
  function focusPending() {
    if (!pendingFocusId) return;
    if (performance.now() > pendingFocusId.until) {
      pendingFocusId = null;
      return;
    }
    const { id, flash, focus = true } = pendingFocusId;
    const at = displayIndexOf(id);
    if (at < 0) return;
    pendingFocusId = null;
    const idle = !document.activeElement || document.activeElement === document.body;
    if (focus && idle) focusAt(at);
    if (flash) flashRow(id);
  }

  // The highlight a row gets once it has been saved (decided with the user, 2026-11-12). A saved note
  // moves to the top, and focus going with it is not enough to see it by: after a click on Save, a
  // focus() from script shows no outline, because the browser keeps the ring for keyboard use. So the row
  // carries data-bb-flash for FLASH_MS, which ui.css fades from the accent tint.
  const flashTimers = new Map();
  function flashRow(id) {
    const row = rows.get(id);
    if (!row) return;
    clearTimeout(flashTimers.get(id));
    row.removeAttribute('data-bb-flash');
    void row.offsetWidth; // restarts the animation on a row flashed twice in a row
    row.setAttribute('data-bb-flash', '');
    flashTimers.set(id, setTimeout(() => {
      row.removeAttribute('data-bb-flash');
      flashTimers.delete(id);
    }, FLASH_MS));
  }

  // A click or Tab lands on a row without focusAt, and moves the tab stop here.
  scroller.addEventListener('focusin', (e) => {
    const row = e.target.closest('.bb-row');
    if (!row || row.dataset.id === activeId) return;
    activeId = row.dataset.id;
    for (const r of rows.values()) r.tabIndex = r === row ? 0 : -1;
  });

  // R12. Arrows move, Enter opens, Delete trashes. No modifiers, so the browser's own shortcuts pass.
  // Enter only from the row itself: on the trash button it is that button's own click.
  //
  // Nothing typed inside an editor is the list's. Delete in the note body deletes a letter, and the
  // arrows move the caret, so a key from there is left alone entirely (T-022).
  scroller.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest('.bb-editor')) return;
    const row = e.target.closest('.bb-row');
    if (!row) return;
    const at = indexOfRow(row);
    const perPage = Math.max(1, Math.floor(scroller.clientHeight / (rowHeight || 1)) - 1);
    switch (e.key) {
      case 'ArrowDown': focusAt(at + 1); break;
      case 'ArrowUp': focusAt(at - 1); break;
      case 'PageDown': focusAt(at + perPage); break;
      case 'PageUp': focusAt(at - perPage); break;
      case 'Home': focusAt(0); break;
      case 'End': focusAt(lay.count - 1); break;
      case 'Delete': trash(row); break;
      case 'Enter':
        if (e.target !== row) return;
        onOpen(notes.get(row.dataset.id));
        break;
      default: return;
    }
    e.preventDefault();
  });

  scroller.addEventListener('click', (e) => {
    if (e.target.closest('.bb-editor')) return;
    const row = e.target.closest('.bb-row');
    if (!row) return;
    if (e.target.closest('[data-bb-act="trash"]')) trash(row);
    else onOpen(notes.get(row.dataset.id));
  });

  // A soft delete, so the note sits in Trash and can come back (02-storage-model.md). The row goes when
  // the worker's 'trash' change arrives, the same as for a delete made anywhere else, and the row that
  // takes its place takes focus too if the deleted one had it. The host does the trashing when it can,
  // because it is the host that has somewhere to put an undo toast (T-022 R5).
  async function trash(row) {
    if (onTrash) return onTrash([row.dataset.id]);
    const reply = await ask({ type: 'notes/trash', ids: [row.dataset.id] });
    if (!reply.ok) say(`Could not move that note to Trash. ${reply.error}`);
  }

  // ---------- Changes from elsewhere ----------
  // R9: patch what changed and leave every other row alone. Anything this cannot place with certainty
  // reloads instead, which is always correct and costs one page.
  //
  // Positions are newest first by updatedAt, and an edit always makes a note the newest, so a created
  // or edited note goes to the top, past every loaded note that is newer. If it would have to land in
  // a page that has not arrived, its place is unknown, and that reloads.
  //
  // The note the open row is anchored to may be the one that moves, edited in another tab. The open row
  // must not follow it to the top, so it is anchored afresh first, as if that note had gone.
  function upsert(note, kind) {
    if (filtering()) return false;
    const was = ids.indexOf(note.id);
    if (was < 0 && kind === 'update') return false;
    if (was >= 0) reanchor([note.id]);
    if (was >= 0) ids.splice(was, 1);
    let at = 0;
    while (at < ids.length && ids[at] !== undefined && notes.get(ids[at]).updatedAt > note.updatedAt) at += 1;
    if (at < ids.length && ids[at] === undefined) return false;
    ids.splice(at, 0, note.id);
    if (was < 0) total += 1;
    notes.set(note.id, note);
    const row = rows.get(note.id);
    if (row) paint(row, note);
    return true;
  }

  // Positions after a removed note move up by one, and a removed note that is not loaded leaves no way
  // to know which positions those are. A filtered list reloads instead, as upsert() does, so that the
  // empty state it may end in is worked out by emptyMessage() and says "match this filter" when it should.
  function remove(gone) {
    if (filtering()) return false;
    const at = gone.map((id) => ids.indexOf(id));
    if (at.some((i) => i < 0)) return false;
    const focused = document.activeElement?.closest?.('.bb-row');
    const refocus = focused && gone.includes(focused.dataset.id) && focused.dataset.id !== open?.id ? indexOfRow(focused) : null;
    reanchor(gone);
    for (const i of at.sort((a, b) => b - a)) {
      const id = ids[i];
      ids.splice(i, 1);
      notes.delete(id);
      drop(id);
    }
    total -= gone.length;
    if (total === 0) emptyText = EMPTY_NONE;
    draw();
    if (refocus !== null && lay.count > 0) focusAt(Math.min(refocus, lay.count - 1));
    return true;
  }

  // A trashed or purged note that is going to be reloaded rather than patched still leaves the screen
  // at once. Without this it would linger until the pages came back, and if its row held focus, draw()
  // would keep it for good: draw() keeps a focused row whose note it still has, which is right for a
  // note between two pages of a reload and wrong for one that has gone. That made Delete look broken
  // whenever its signal arrived within OVERTAKE_MS of a page, or in a filtered list (found by the user's
  // hand test, 2026-11-11).
  //
  // Its position is emptied and not removed, so nothing after it moves. Moving them is the patch that
  // the reload is there to avoid, and the hole is simply asked for again. Where the focused row was is
  // where focus goes once the answer arrives.
  function reloadWithout(gone) {
    const focusedId = document.activeElement?.closest?.('.bb-row')?.dataset.id;
    let refocus = null;
    relayout();
    reanchor(gone);
    for (const id of gone) {
      const at = ids.indexOf(id);
      if (id === focusedId && id !== open?.id) refocus = displayIndexOf(id);
      if (at >= 0) delete ids[at];
      notes.delete(id);
      drop(id);
    }
    reload();
    if (refocus !== null && refocus >= 0) pendingFocus = refocus;
  }

  // Takes a gone note's row off screen, unless it is the open one. That row holds an editor and whatever
  // is typed in it, so it stays, and the host is told once, so that it can save what is there and call
  // collapse(). The worker still takes an update to a note in Trash (repo.js), so nothing typed is lost.
  function drop(id) {
    if (open && id === open.id) {
      if (!open.gone) {
        open.gone = true;
        onGone(id);
      }
      return;
    }
    rows.get(id)?.remove();
    rows.delete(id);
  }

  // When the note the open row is anchored to goes, the open row anchors to the next note above it that
  // stays, so that it moves up with the rows around it rather than jumping. Skips the open note itself,
  // whose model slot is wherever its last save put it. A hole above means the neighbour is not known, and
  // the row then keeps its position, one up for the note that went.
  function reanchor(gone) {
    if (!open || open.anchor.id === null || !gone.includes(open.anchor.id)) return;
    relayout();
    let a = ids.indexOf(open.anchor.id);
    let next = null;
    let hole = false;
    while (a > 0 && next === null && !hole) {
      a -= 1;
      const id = ids[a];
      if (id === undefined) hole = true;
      else if (id !== open.id && !gone.includes(id)) next = id;
    }
    open.anchor.id = next;
    if (next === null) open.anchor.at = hole ? Math.max(0, lay.d - 1) : 0;
  }

  // A tag nobody had used before comes into being in the same write as the note that carries it, and
  // the worker reports that write as a 'create' or an 'update', never as 'tags' (repo.js, ensureTags).
  // Its label, the spelling the user typed, is then missing here, and the chip would show the folded
  // name, "faith" for "Faith", until something else refreshed the lookups. So a note that carries a
  // tag or a topic these maps have not heard of refreshes them before it is drawn.
  const known = (note) => (note.tags ?? []).every((name) => lookups.tags.has(name))
    && (note.topicId == null || lookups.topics.has(note.topicId));

  // Fetches the maps again and repaints every row on screen with them. lookupsLoaded keeps a page that
  // lands before the very first fetch from asking for a second one.
  let lookupsLoaded = false;
  async function refreshLookups() {
    lookups = await loadLookups(lookups);
    lookupsLoaded = true;
    for (const [id, row] of rows) {
      const note = notes.get(id);
      if (note) paint(row, note);
    }
  }

  // arrivedAt is when the change signal reached this frame, taken before it waited its turn in the
  // queue below, so that OVERTAKE_MS is measured against the moment the write became known here.
  //
  // A topic or tag change refreshes the maps whatever the list is doing, since a page cannot bring
  // them. Any other change before the list has a total, which is while the first page of a list or of a
  // new filter is on its way, asks for that page again: the answer in flight may have been worked out
  // before the write.
  async function onChange({ kind, ids: changed }, arrivedAt) {
    if (kind === 'topics' || kind === 'tags') {
      await refreshLookups();
      reload();
      return;
    }
    if (total === null) {
      reload();
      return;
    }
    // A trash, restore or purge that moved nothing still bumps, with no ids (03-messaging.md).
    if (!changed.length) return;
    const goneKind = kind === 'trash' || kind === 'purge';
    if (lastReplyAt > arrivedAt - OVERTAKE_MS) {
      reloadWithout(goneKind ? changed : []);
      return;
    }
    newGeneration();
    if (goneKind) {
      if (!remove(changed)) reloadWithout(changed);
      return;
    }
    // An edit can reach a note that is in Trash, or one purged since, and either way it does not belong
    // in the list: if it is there it goes, and if it is not there is nothing to do.
    if (kind === 'create' || kind === 'update') {
      const replies = await Promise.all(changed.map((id) => ask({ type: 'notes/get', id })));
      if (replies.some((r) => r.note && !known(r.note))) await refreshLookups();
      const gone = changed.filter((id, i) => replies[i].ok && !(replies[i].note && replies[i].note.deletedAt == null));
      let placed = replies.every((r) => r.ok);
      for (let i = 0; placed && i < replies.length; i += 1) {
        const { note } = replies[i];
        if (note && note.deletedAt == null) placed = upsert(note, kind);
        else if (ids.includes(changed[i])) placed = remove([changed[i]]);
      }
      if (placed) {
        draw();
        focusPending();
      } else reloadWithout(gone);
      return;
    }
    reload(); // 'restore', and anything new: a restored note comes back where it was, mid-list
  }

  // One change at a time, in the order they arrived, because each one shifts the positions the next
  // one works from.
  let changeTail = Promise.resolve();
  const stop = onNotesChange((change) => {
    const arrivedAt = performance.now();
    changeTail = changeTail.then(() => onChange(change, arrivedAt)).catch((err) => {
      console.error('[BibleBoost] list: could not apply a change', err);
      reload();
    });
  });

  // ---------- Start ----------
  // R11. Nothing at all for the first LOADING_DELAY_MS, and the word only if the answer is still not in
  // by then. Started again for every new filter, which is a new list with nothing to show yet.
  let loadingTimer = 0;
  function startLoading() {
    clearTimeout(loadingTimer);
    say('');
    loadingTimer = setTimeout(() => {
      if (total === null && !error) say('Loading…');
    }, LOADING_DELAY_MS);
  }
  startLoading();

  // The lookups come in beside the first page, and repaint whatever rows that page has already drawn.
  refreshLookups();
  loadPage(0);

  // setFilter is T-023's way in, and the console's until then. A new filter is a different list, so it
  // starts from the top with nothing on screen.
  //
  // An open row survives it, at the top, because it holds an editor. The host should close its editor
  // first (T-030 R1 asks for a flush before a filter change), and T-023 will.
  function setFilter(next = {}) {
    filter = { ...next };
    newGeneration();
    fresh.clear();
    ids = [];
    notes.clear();
    total = null;
    error = null;
    activeId = null;
    pendingFocusId = null;
    if (open) open.anchor = { id: null, at: 0 };
    scroller.scrollTop = 0;
    startLoading();
    draw();
    loadPage(0);
  }

  // ---------- The open row (T-022) ----------
  // Shows el inside a row, and makes room for it. The row is measured now and again whenever it changes
  // size, a textarea dragged taller or a suggestion list opening, and the rows after it move to suit.
  // The observer calls draw() directly rather than on the next frame: it runs after layout and before
  // paint, so the rows below are moved before anyone sees them overlap.
  function hold(id, row, el, anchor) {
    open = { id, el, row, anchor, extra: 0, observer: null, gone: false };
    row.setAttribute('data-bb-open', '');
    row.append(el);
    activeId = id;
    open.extra = Math.max(0, row.offsetHeight - rowHeight);
    open.observer = new ResizeObserver(() => {
      if (!open || open.row !== row) return;
      const extra = Math.max(0, row.offsetHeight - rowHeight);
      if (extra === open.extra) return;
      open.extra = extra;
      draw();
    });
    open.observer.observe(row);
    draw();
    reveal(lay.d);
    draw();
  }

  // Expands note id's row in place (R1). Its anchor is the note above it now. Returns false if the row is
  // not on screen, which a click or Enter on it means it always is.
  function openRow(id, el) {
    if (open) collapse();
    relayout();
    const row = rows.get(id);
    if (!row) return false;
    const k = ids.indexOf(id);
    hold(id, row, el, { id: k > 0 ? (ids[k - 1] ?? null) : null, at: Math.max(0, k) });
    return true;
  }

  // A row for a note that does not exist yet (R4), at the top, where a new note will land once it is
  // saved, since it will be the newest.
  function openNew(el) {
    if (open) collapse();
    // An empty list has its scroller hidden and has never measured a row, and a hidden box measures 0.
    scroller.hidden = false;
    if (!rowHeight) rowHeight = measure();
    scroller.scrollTop = 0;
    const row = buildRow();
    paintNew(row);
    rows.set(NEW_ROW, row);
    scroller.append(row);
    hold(NEW_ROW, row, el, { id: null, at: 0 });
  }

  // The new note has been stored as id. Its row becomes that note's row without moving in the DOM, so
  // the caret stays where it is. The worker's 'create' signal and the reply to notes/create race, and if
  // the signal won, the list has already drawn a row of its own for id: that one goes.
  function adopt(id) {
    if (!open || open.id !== NEW_ROW) return;
    const dup = rows.get(id);
    if (dup && dup !== open.row) dup.remove();
    rows.delete(NEW_ROW);
    open.id = id;
    open.row.dataset.id = id;
    rows.set(id, open.row);
    if (activeId === NEW_ROW) activeId = id;
    const note = notes.get(id);
    if (note) paint(open.row, note);
    draw();
  }

  // Takes the editor out and lets the row fall back into the list's order: to the top if the note was
  // edited, since it is now the newest (decided with the user, 2026-11-12). focus gives focus to it
  // there, scrolling the list if need be. keep names a row that should stay where it is on screen, the one
  // just clicked, so that it does not jump from under the pointer as the open row above it shrinks away.
  //
  // A row whose note has gone, a new note never saved or one trashed elsewhere, goes with its editor, and
  // focus then goes to the row that took its place.
  //
  // flash is for a note that was just saved: its row is highlighted wherever it lands. A new note saved a
  // moment ago may not be placed yet, because the worker's 'create' signal can arrive after the reply
  // that closed the editor. Then focus and the highlight wait for it, through focusPending().
  function collapse({ focus = false, keep = null, flash = false } = {}) {
    if (!open) return;
    relayout();
    const was = lay.d;
    const keepAt = keep ? displayIndexOf(keep) : -1;
    const keepY = keepAt >= 0 ? topOf(keepAt) - scroller.scrollTop : null;
    const { id, el, row, observer, gone } = open;
    observer.disconnect();
    open = null;
    el.remove();
    row.removeAttribute('data-bb-open');
    const stays = id !== NEW_ROW && notes.has(id) && ids.includes(id);
    if (stays) paint(row, notes.get(id));
    else {
      row.remove();
      rows.delete(id);
      if (activeId === id) activeId = null;
    }
    draw();
    if (keepY !== null) {
      const at = displayIndexOf(keep);
      if (at >= 0) {
        scroller.scrollTop = topOf(at) - keepY;
        draw();
      }
    }
    if (stays) {
      if (focus) focusAt(displayIndexOf(id));
      if (flash) flashRow(id);
    } else if (flash && !gone && id !== NEW_ROW) {
      pendingFocusId = { id, until: performance.now() + FOCUS_WAIT_MS, flash: true, focus };
      focusPending();
    } else if (focus && lay.count) {
      focusAt(Math.min(was, lay.count - 1));
    }
  }

  // Focus to the list's tab stop, for a host whose own focus has just gone away (a toast dismissed).
  function focusList() {
    relayout();
    const at = activeId ? displayIndexOf(activeId) : -1;
    if (lay.count) focusAt(at >= 0 ? at : indexAt(scroller.scrollTop));
  }

  // After Undo: focus that note as soon as it is back on the list, or now if it already is.
  function focusWhenPlaced(id) {
    pendingFocusId = { id, until: performance.now() + FOCUS_WAIT_MS };
    relayout();
    focusPending();
  }

  return {
    setFilter,
    reload,
    open: openRow,
    openNew,
    adopt,
    collapse,
    focus: focusList,
    focusWhenPlaced,
    get openId() { return open?.id ?? null; },
    // The topic and tag maps the rows are drawn with, so an editor opening can show its topic's name at
    // once rather than after a round trip.
    get lookups() { return lookups; },
    destroy() {
      stop();
      clearTimeout(loadingTimer);
      open?.observer.disconnect();
      status.remove();
      scroller.remove();
    },
    // For the console and the hand test: what is loaded, and how many rows the DOM really holds.
    get stats() {
      return { total, loaded: ids.filter((id) => id !== undefined).length, rows: rows.size, open: open?.id ?? null };
    },
  };
}
