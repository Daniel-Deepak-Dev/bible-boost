/*
 * BibleBoost — the suggestion list
 * The combobox under the topic and tag fields of the editor (T-022 R1). It is a port of suggestionList
 * and startRow in src/content/save-popover.js, so that picking a topic or adding a tag behaves the same
 * when a note is saved and when it is edited later. A classic script cannot import an ES module, so the
 * popover keeps its copy and this is the second one. A change to either belongs in both, and
 * test/editor.test.js runs startRow from both files over the same rows.
 *
 * Two differences from the popover's copy, both because this one lives inside a list row and not in a
 * dialog of its own:
 *
 * - The options are in the flow under the input rather than floating over what follows. The row that
 *   holds the editor clips what overflows it, and it sits in a scroller that would clip it again. In the
 *   flow, the row simply grows while the list is open, and the note list learns the new height from its
 *   ResizeObserver.
 * - A mousedown on an option is cancelled, so that the input keeps focus through the click. The popover
 *   gets that from its dialog's own mousedown guard. Without it the input blurs first, the blur closes
 *   the list, and the click lands on nothing.
 */

function make(tag, attrs = {}, text) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  if (text !== undefined) el.textContent = text;
  return el;
}

// A row is { label } plus whatever its owner wants back, or { label, hint: true } for one that can be
// seen and not chosen. An owner may mark one row { current: true }, the choice already made.
//
// Where the highlight starts when a list opens: the current choice if there is one (B-013), otherwise
// the first row that can be picked, and -1 when none can. A hint is never started on, even a current one.
export function startRow(rows) {
  const current = rows.findIndex((r) => r.current && !r.hint);
  return current >= 0 ? current : rows.findIndex((r) => !r.hint);
}

// input is the text field, list an empty <ul> with an id, getRows(value) the rows for what is typed and
// pick(row) what choosing one does. autoActive highlights a row as the list opens: right for the topic,
// where "fai" then Enter should take Faith, and wrong for tags, where Enter means "this is the tag".
//
// Focus stays in the input the whole time, with aria-activedescendant naming the row, so the keyboard
// and the screen reader cannot disagree about which row is meant.
export function suggestionList(input, list, getRows, pick, { autoActive = false } = {}) {
  let rows = [];
  let active = -1;
  // Whether the highlight is where the arrow keys put it, rather than where open() did. Only refresh
  // reads it.
  let steered = false;

  list.setAttribute('role', 'listbox');
  list.hidden = true;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');

  function close() {
    list.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function draw() {
    list.replaceChildren(...rows.map((row, i) => {
      const li = make('li', { id: `${list.id}-${i}`, role: 'option', 'aria-selected': String(i === active) }, row.label);
      if (row.hint) li.setAttribute('aria-disabled', 'true');
      return li;
    }));
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (active < 0) return input.removeAttribute('aria-activedescendant');
    input.setAttribute('aria-activedescendant', `${list.id}-${active}`);
    list.children[active].scrollIntoView({ block: 'nearest' });
  }

  function open() {
    rows = getRows(input.value);
    if (!rows.length) return close();
    active = autoActive ? startRow(rows) : -1;
    steered = false;
    draw();
  }

  // For an owner whose rows have changed underneath an open list (B-017 R4). A closed list stays closed,
  // and a row somebody arrowed to keeps the highlight if it is still listed.
  function refresh() {
    if (list.hidden) return;
    const held = steered ? rows[active]?.label : null;
    const fresh = getRows(input.value);
    const at = fresh.findIndex((r) => !r.hint && r.label === held);
    if (at < 0) return open();
    rows = fresh;
    active = at;
    draw();
  }

  // Steps over hint rows. From nothing highlighted, Up lands on the last row.
  function move(step) {
    const live = rows.flatMap((r, i) => (r.hint ? [] : [i]));
    if (!live.length) return;
    const at = live.indexOf(active);
    active = live[(at + step + live.length + (at < 0 && step < 0 ? 1 : 0)) % live.length];
    steered = true;
    draw();
  }

  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const row = rows[[...list.children].indexOf(e.target.closest('li'))];
    if (row && !row.hint) pick(row);
  });
  input.addEventListener('blur', close);

  // True when the key was used. Escape is stopped here so that the first press closes the list and only
  // a second one closes the editor. Enter with Ctrl or Cmd held is the editor's "save and close", whatever
  // the list has highlighted.
  function onKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) open(); else move(e.key === 'ArrowDown' ? 1 : -1);
      return true;
    }
    if (list.hidden) return false;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return true;
    }
    if (e.key === 'Enter' && active >= 0 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      pick(rows[active]);
      return true;
    }
    return false;
  }

  return { open, close, refresh, onKey, get isOpen() { return !list.hidden; } };
}
