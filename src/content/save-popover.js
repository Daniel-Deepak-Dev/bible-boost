/*
 * BibleBoost — the save popover
 * Where a selected verse becomes a stored note: the reference, a topic, tags and a Markdown body, then
 * one notes/create to the worker. Everything capture.js knows about the page meets the data layer here
 * for the first time.
 *
 * Its own file rather than part of menu.js because T-015 has to be able to open it with menu.js gone.
 * A save path that needs the row in bible.com's menu is not a fallback for that row.
 *
 * It sends raw drafts (architecture rule 2). Nothing here generates an id, normalizes a tag or decides
 * whether a note is valid. The one place text is folded is for matching what the user types against
 * the suggestion lists, and that never reaches the draft.
 *
 * Classic script, and the manifest runs it AFTER capture.js, which it reads as it loads.
 */
var BB = (typeof BB !== 'undefined') ? BB : {};

(() => {
  const { VID_RE, columnEls, firstSpans } = BB.dom;
  const { getSelection, versePair, displayRef } = BB.capture;

  // A null id is what the schema calls Uncategorized, and there is no such topic row (T-003 R8). Shaped
  // like a topic so that the picker has only one kind of thing to list.
  const UNCATEGORIZED = Object.freeze({ id: null, name: 'Uncategorized' });

  // sessionStorage and not a variable in this file, because a variable dies on a full navigation and
  // Alt+P is one (setParallel uses location.assign). It is not chrome.storage.session either: content
  // scripts cannot read that without a setAccessLevel call, and it would give two tabs holding two
  // different studies a single last topic. Only an id is kept, and it is honoured only if topics/list
  // still has it, so whatever the page does to this key costs at most a wrong preselection.
  const LAST_TOPIC_KEY = 'bb-last-topic';

  const NEW_TOPIC_HINT = '+ New topic: type a name';
  const NO_PANEL_HINT = 'Arrives with the side panel';
  const NO_REPLY_ERROR = 'BibleBoost did not answer. Please try again.';
  const LOST_ERROR = 'This page has lost touch with BibleBoost, which usually means it was just updated. Copy your note, reload the page, and save again.';

  const GUTTER = 16;     // the same side gutter the page keeps at phone width
  const ANCHOR_GAP = 8;  // between the verse and the popover
  const TOAST_MS = 5000; // T-035 R2's "~5 seconds"

  // Everything belonging to the popover that is open now, or null. There can only be one, and building
  // it fresh on every open means nothing has to be reset and nothing stays on the page between saves.
  let pop = null;

  // ---------- Small helpers ----------
  // createElement and textContent only (hard rule 2). Topic names and tags are user content, and they
  // can arrive from an imported file.
  function make(tag, attrs = {}, text) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // NFC first, then toLocaleLowerCase, the rule everywhere (hard rule 7). A copy of fold() because
  // normalize.js is an ES module and a classic script cannot import one. Unlike that function this
  // only ever decides what a suggestion list shows, so a drift between the two would cost a suggestion
  // and could not change a stored tag.
  const fold = (s) => s.normalize('NFC').toLocaleLowerCase();

  // ---------- Talking to the worker ----------
  // Every failure comes back as { ok: false, error: <string> }, the same shape the router uses for its
  // own, so a caller has one thing to check and R5 has one path to take.
  //
  // The catch is not padding. After the extension is reloaded, a content script already in a tab is
  // orphaned and sendMessage throws "Extension context invalidated". That tab can still hold a
  // half-written note, which is why the message tells the user to copy it before doing anything else.
  // A missing reply is the worker dying part way through, and sendResponse being given nothing.
  async function ask(msg) {
    try {
      return (await chrome.runtime.sendMessage(msg)) ?? { ok: false, error: NO_REPLY_ERROR };
    } catch (err) {
      console.debug('[BibleBoost] popover: could not reach the worker', msg.type, err);
      return { ok: false, error: LOST_ERROR };
    }
  }

  // ---------- Reading the verses ----------
  // The column showing one side of a verse. versePair answers in version ids and displayRef wants the
  // element, and the id is the only thing that says which column is which (T-010 R2).
  const columnOf = (side) => columnEls().find((c) => c.getAttribute('class').match(VID_RE)?.[1] === side.versionId);

  // usfm -> one entry of the draft's verses, as raw as the page gives it.
  //
  // displayRef answers per column while VerseRef.displayRef is a single field, so it asks the column of
  // the side that exists, the primary one if it can. null is an ordinary answer: cleanNoteDraft stores
  // it as '' and R1's usfm fallback is what shows then. Both calls are safe with a column that turned
  // out not to exist, because displayRef catches its own failure and answers null.
  //
  // A verse only the parallel column has moves its one side into primary. cleanSide refuses a null
  // primary, and one such verse would otherwise refuse the whole draft, while leaving it out would
  // quietly lose a verse the user chose. The side brings its own versionId and abbr with it, so nothing
  // is mislabelled: primary means the version this note leads with, usually but not always the page's.
  //
  // With neither side there is nothing to keep, and that goes through unchanged, so the worker refuses
  // it and the user is told why.
  function verseRefOf(usfm) {
    const pair = versePair(usfm);
    const primary = pair.primary ?? pair.parallel;
    const parallel = pair.primary ? pair.parallel : null;
    return { usfm, displayRef: primary ? displayRef(usfm, columnOf(primary)) : null, primary, parallel };
  }

  // Read once, when the popover opens, and never again. The menu's header is the best source of a
  // reference and it speaks only while the menu is up, and this way the reference on the popover is
  // exactly what gets saved, whatever the page does in the meantime.
  const readVerses = (selection) => selection.usfms.map(verseRefOf);

  // ---------- The suggestion list ----------
  // Shared by the topic picker and the tag input, which differ only in what they list and what picking
  // does. A row is { label } plus whatever its owner wants back, or { label, hint: true } for one that
  // can be seen and not chosen.
  //
  // Focus stays in the input the whole time, with aria-activedescendant naming the row, so the two
  // keyboard models cannot disagree. The rows are redrawn inside our own subtree, which the T-004 guard
  // reads as ours.
  //
  // autoActive puts the highlight on the first row as the list opens. The topic picker wants that:
  // typing "fai" and pressing Enter should take Faith. The tag input must not have it, because there
  // Enter means "this is the tag", and a highlight would turn the "fai" the user meant into "faith".
  function suggestionList(input, list, getRows, pick, { autoActive = false } = {}) {
    let rows = [];
    let active = -1;

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
      active = autoActive ? rows.findIndex((r) => !r.hint) : -1;
      draw();
    }

    // Steps over hint rows. From nothing highlighted, Up lands on the last row rather than the second
    // to last, which is what the +1 is for.
    function move(step) {
      const live = rows.flatMap((r, i) => (r.hint ? [] : [i]));
      if (!live.length) return;
      const at = live.indexOf(active);
      active = live[(at + step + live.length + (at < 0 && step < 0 ? 1 : 0)) % live.length];
      draw();
    }

    // A click and not a mousedown, because the dialog's mousedown guard already keeps focus here.
    list.addEventListener('click', (e) => {
      const row = rows[[...list.children].indexOf(e.target.closest('li'))];
      if (row && !row.hint) pick(row);
    });
    input.addEventListener('blur', close);

    // True when the key was used. Escape is stopped here so that the first press closes the list and
    // only a second closes the popover.
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
      // Not with Ctrl or Cmd held, which means save (R7), whatever the list has highlighted.
      if (e.key === 'Enter' && active >= 0 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        pick(rows[active]);
        return true;
      }
      return false;
    }

    return { open, close, onKey };
  }

  // ---------- Status ----------
  function showError(message) {
    pop.error.textContent = message;
    pop.error.hidden = false;
    keepInView();
  }

  function clearError() {
    pop.error.hidden = true;
  }

  // aria-disabled and not disabled. A disabled button loses focus at the moment it is pressed, and when
  // the save fails the user has to be able to carry on from where they were (R5).
  function setBusy(busy) {
    pop.busy = busy;
    pop.saveBtn.setAttribute('aria-disabled', String(busy));
  }

  // ---------- Topic ----------
  function chooseTopic(topic) {
    pop.topic = topic;
    pop.topicInput.value = topic.name;
  }

  // While the input still reads as the current choice, nobody has filtered anything yet, so every topic
  // is listed. The last row is always there, so the way to make a topic can be seen before anyone
  // needs it, and it only does something once there is a name to use.
  function topicRows(value) {
    const name = value.trim();
    const filter = name && name !== pop.topic.name ? fold(name) : '';
    const rows = [UNCATEGORIZED, ...pop.topics]
      .filter((t) => fold(t.name).includes(filter))
      .map((topic) => ({ label: topic.name, topic }));
    const canCreate = filter && !rows.some((r) => fold(r.label) === filter);
    rows.push(canCreate ? { label: `+ New topic "${name}"`, create: name } : { label: NEW_TOPIC_HINT, hint: true });
    return rows;
  }

  // On failure the name stays in the input and the error beside it (R5).
  async function pickTopic(row) {
    pop.topicList.close();
    if (!row.create) return chooseTopic(row.topic);
    if (pop.busy) return;
    clearError();
    setBusy(true);
    const reply = await ask({ type: 'topics/create', name: row.create });
    setBusy(false);
    if (!reply.ok) return showError(reply.error);
    pop.topics.push(reply.topic);
    chooseTopic(reply.topic);
  }

  function onTopicKey(e) {
    if (e.isComposing) return;
    const used = pop.topicList.onKey(e);
    if (used && e.key === 'Escape') pop.topicInput.value = pop.topic.name;
  }

  // ---------- Tags ----------
  function drawChips() {
    pop.chips.replaceChildren(...pop.tags.map((tag) => {
      const chip = make('span', { class: 'bb-chip' }, tag);
      const remove = make('button', { type: 'button', 'aria-label': `Remove tag ${tag}` }, '×');
      remove.addEventListener('click', () => removeTag(tag));
      chip.append(remove);
      return chip;
    }));
    keepInView();
  }

  // The chip holds what was typed and that is what gets sent, because a tag's spelling is the worker's
  // to resolve (R3). Comparing here only stops two chips appearing for the one tag they would become.
  function addTag(raw) {
    const tag = raw.trim();
    pop.tagInput.value = '';
    if (!tag || pop.tags.some((t) => fold(t) === fold(tag))) return;
    pop.tags.push(tag);
    drawChips();
  }

  // Focus goes back to the input, since the button that held it has just been removed.
  function removeTag(tag) {
    pop.tags = pop.tags.filter((t) => t !== tag);
    drawChips();
    pop.tagInput.focus();
  }

  function tagRows(value) {
    const query = fold(value.trim());
    return pop.knownTags
      .filter(({ label }) => fold(label).includes(query) && !pop.tags.some((t) => fold(t) === fold(label)))
      .map(({ label }) => ({ label }));
  }

  function pickTag(row) {
    addTag(row.label);
    pop.tagList.close();
  }

  // isComposing because a Tamil input method uses Enter to confirm what it is composing. Treating that
  // Enter as "commit the tag" would store half a word, and English testing would never show it.
  function onTagKey(e) {
    if (e.isComposing || pop.tagList.onKey(e)) return;
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      addTag(pop.tagInput.value);
      pop.tagList.close();
    } else if (e.key === 'Backspace' && !pop.tagInput.value && pop.tags.length) {
      removeTag(pop.tags.at(-1));
    }
  }

  // ---------- Remembering the topic ----------
  // Both wrapped, because sessionStorage throws outright when a page's site data is blocked, and a
  // preference must not be able to stop a save.
  function recallTopic() {
    try { return sessionStorage.getItem(LAST_TOPIC_KEY); } catch { return null; }
  }

  function rememberTopic(id) {
    try {
      if (id) sessionStorage.setItem(LAST_TOPIC_KEY, id);
      else sessionStorage.removeItem(LAST_TOPIC_KEY);
    } catch (err) {
      console.debug('[BibleBoost] popover: could not remember the topic', err);
    }
  }

  // ---------- The lists ----------
  // Asked for on every open, so that a topic made in another tab is there. The popover has already
  // appeared by now and is usable with Uncategorized alone, which is also where it stays if this fails:
  // the verse text is safe in the popover, and Save will report the same trouble if it is still there.
  //
  // The topic is not preselected over somebody who has already started typing in that field.
  async function loadLists(here) {
    const [topics, tags] = await Promise.all([ask({ type: 'topics/list' }), ask({ type: 'tags/list' })]);
    if (pop !== here) return;
    if (topics.ok) here.topics = topics.topics;
    if (tags.ok) here.knownTags = tags.tags;
    const failed = [topics, tags].find((r) => !r.ok);
    if (failed) showError(failed.error);
    const last = here.topics.find((t) => t.id === recallTopic());
    if (last && document.activeElement !== here.topicInput) chooseTopic(last);
  }

  // ---------- Saving ----------
  // Text still in the tag input counts, or a tag typed without Enter disappears with no word said.
  //
  // title is not sent: a note with none falls back to its verse range when it is shown. The panel is
  // opened through ?. since the panel is EPIC-02 and this button stays disabled until it exists.
  async function save({ openPanel = false } = {}) {
    if (pop.busy) return;
    addTag(pop.tagInput.value);
    clearError();
    setBusy(true);
    const reply = await ask({
      type: 'notes/create',
      draft: { source: 'menu', body: pop.body.value, topicId: pop.topic.id, tags: pop.tags, verses: pop.verses },
    });
    setBusy(false);
    if (!reply.ok) return showError(reply.error);
    rememberTopic(pop.topic.id);
    const topicName = pop.topic.name;
    const { top, left } = pop.dialog.getBoundingClientRect();
    requestClose();
    showSaved(reply.note, topicName, { top, left });
    if (openPanel) BB.panel?.open?.();
  }

  // ---------- The confirmation ----------
  // Its own small toast. T-035 will build the shared one in src/ui/app/, and that is an ES module that
  // a classic script cannot import. One at a time is enough for something saved by hand.
  //
  // It appears where the popover just was, because that is where the user is looking. It first sat at
  // the top of the viewport, clear of bible.com's menu card and the dock, and in a real-Chrome check on
  // 2026-11-10 somebody watching for the Undo did not see it: it landed on the search bar, dark on dark.
  // Covering part of bible.com's menu for five seconds is the cheaper trade.
  //
  // The timer checks rather than pauses: if the pointer or the focus is on the toast when it runs out it
  // starts over, so the Undo cannot be taken away from somebody reaching for it (T-035 R6).
  let toastEl = null;
  let toastTimer = null;

  function armToast() {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toastEl?.matches(':hover, :focus-within')) armToast();
      else dismissToast();
    }, TOAST_MS);
  }

  function dismissToast() {
    clearTimeout(toastTimer);
    toastEl?.remove();
    toastEl = null;
  }

  // Undo moves the note to Trash, because the storage model keeps hard deletes to Trash and auto-purge,
  // and the repo refuses to purge a live note. A mistaken Undo stays recoverable that way.
  function showSaved(note, topicName, { top, left }) {
    dismissToast();
    const box = make('div', { id: 'bb-toast', 'data-bb-own': '', role: 'status', 'aria-live': 'polite' });
    box.style.top = `${top}px`;
    box.style.left = `${left}px`;
    const message = make('span', {}, `Saved to ${topicName}`);
    const undo = make('button', { type: 'button' }, 'Undo');
    undo.addEventListener('click', async () => {
      undo.remove();
      const reply = await ask({ type: 'notes/trash', ids: [note.id] });
      message.textContent = reply.ok ? 'Moved to Trash' : `Could not undo: ${reply.error}`;
      armToast();
    }, { once: true });
    document.body.append(box);
    box.append(message, undo);
    toastEl = box;
    armToast();
  }

  // ---------- Position ----------
  const onScreen = (r) => r && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  const clamp = (value, far) => Math.max(GUTTER, Math.min(value, far - GUTTER));

  // The first selected verse if it is in view, or failing that whatever opened the popover. The selected
  // verse can be scrolled off by now: bible.com moves the page to keep it clear of its own menu.
  function anchorRect() {
    const [{ usfm, primary }] = pop.verses;
    const col = primary && columnOf(primary);
    const verse = col && firstSpans(col).get(usfm);
    return [verse?.getBoundingClientRect(), pop.trigger?.getBoundingClientRect()].find(onScreen) ?? null;
  }

  // Under the verse if that fits, over it if that fits, and otherwise as low as it can go. With nothing
  // to anchor to it goes in the middle. Only called once the dialog is showing, since it has no size
  // before that, and before anything has been painted.
  function place() {
    const rect = anchorRect();
    const { width, height } = pop.dialog.getBoundingClientRect();
    const farTop = window.innerHeight - height;
    const farLeft = window.innerWidth - width;
    let top = farTop / 2;
    let left = farLeft / 2;
    if (rect) {
      const below = rect.bottom + ANCHOR_GAP;
      const above = rect.top - ANCHOR_GAP - height;
      top = below <= farTop - GUTTER ? below : above >= GUTTER ? above : farTop;
      left = rect.left;
    }
    pop.dialog.style.top = `${clamp(top, farTop)}px`;
    pop.dialog.style.left = `${clamp(left, farLeft)}px`;
  }

  // For the popover changing size or the window changing under it. It never re-anchors, because a form
  // that jumps from below the verse to above it because a tag wrapped is worse than one that stays put.
  function keepInView() {
    if (!pop) return;
    const { top, left, width, height } = pop.dialog.getBoundingClientRect();
    pop.dialog.style.top = `${clamp(top, window.innerHeight - height)}px`;
    pop.dialog.style.left = `${clamp(left, window.innerWidth - width)}px`;
  }

  // ---------- Keyboard and focus ----------
  // showModal already makes the page inert, but Tab off the last field still goes to the browser's own
  // toolbar. R7 says trapped, so it comes back round instead.
  function wrapTab(e) {
    const stops = [...pop.dialog.querySelectorAll('input, textarea, button:not([disabled])')];
    const from = e.shiftKey ? stops[0] : stops.at(-1);
    const to = e.shiftKey ? stops.at(-1) : stops[0];
    if (document.activeElement !== from) return;
    e.preventDefault();
    to.focus();
  }

  // Stopped at the dialog so that bible.com's own document listeners never see these keys. They are
  // not ours to audit, and an arrow key moving the caret must never be able to turn the page.
  //
  // isComposing again: Escape during composition belongs to the input method, and closing the popover
  // over it would throw away the note.
  //
  // The preventDefault on Escape is what stops the browser's own close from also running.
  function onKeydown(e) {
    e.stopPropagation();
    if (e.isComposing) return;
    if (e.key === 'Tab') {
      wrapTab(e);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      requestClose();
    }
  }

  // Whatever is pressed, the caret stays in the field it was in, unless the press was on something that
  // takes focus for itself. Without this, a click on the backdrop or on the padding would move focus to
  // the dialog's own element, and Ctrl+Enter would stop working until the user clicked back in.
  function onMousedown(e) {
    if (!e.target.closest('input, textarea, button, label')) e.preventDefault();
  }

  // ---------- Building it ----------
  function fieldLabel(id, text) {
    return make('label', { for: id }, text);
  }

  function button(text, attrs, onClick) {
    const b = make('button', { type: 'button', class: 'bb-btn', ...attrs }, text);
    b.addEventListener('click', onClick);
    return b;
  }

  // data-bb-own goes on this root only: the T-004 guard walks up with closest(), so everything inside
  // inherits it, the rows of the suggestion lists included.
  //
  // No <form>, so that Enter in a field cannot submit anything by accident: R7 gives Enter a different
  // meaning in each field. The inputs carry dir="auto" because a note or a tag may be in any script,
  // Arabic included, and the interface's own direction says nothing about the one being typed in.
  //
  // The Save & open panel button is disabled rather than absent because R1 asks for it, and rather than
  // live because saving and then opening nothing would be saying something untrue. T-017 turns it on
  // by defining BB.panel.open.
  function build(verses, trigger) {
    const dialog = make('dialog', { id: 'bb-save-pop', 'data-bb-own': '', 'aria-label': 'Save to BibleBoost' });
    const reference = verses.map((v) => v.displayRef || v.usfm).join(', ');

    const topicInput = make('input', { id: 'bb-save-topic', type: 'text', dir: 'auto', autocomplete: 'off', spellcheck: 'false', placeholder: 'Find or create a topic' });
    const topicRowsEl = make('ul', { id: 'bb-save-topic-list', class: 'bb-list', role: 'listbox' });
    topicRowsEl.hidden = true;

    const chips = make('span', { class: 'bb-chips' });
    const tagInput = make('input', { id: 'bb-save-tags', type: 'text', dir: 'auto', autocomplete: 'off', spellcheck: 'false', placeholder: 'Add a tag' });
    const tagRowsEl = make('ul', { id: 'bb-save-tags-list', class: 'bb-list', role: 'listbox' });
    tagRowsEl.hidden = true;

    // Fixed at four rows with no drag handle, because this is the compact surface (R9) and T-022 is
    // where long notes get room.
    const body = make('textarea', { id: 'bb-save-body', dir: 'auto', rows: '4', placeholder: 'Write a note (Markdown)' });
    const error = make('p', { class: 'bb-error', role: 'alert' });
    error.hidden = true;

    const panelReady = typeof BB.panel?.open === 'function';
    const panelBtn = button('Save & open panel', panelReady ? {} : { disabled: '', title: NO_PANEL_HINT }, () => save({ openPanel: true }));
    const saveBtn = button('Save', { 'data-bb-primary': '' }, () => save());
    const cancelBtn = button('Cancel', {}, () => requestClose());

    const topicBox = make('div', { class: 'bb-combo' });
    topicBox.append(topicInput, topicRowsEl);
    const tagBox = make('div', { class: 'bb-combo' });
    const tagField = make('div', { class: 'bb-tagbox' });
    tagField.append(chips, tagInput);
    tagBox.append(tagField, tagRowsEl);
    const actions = make('div', { class: 'bb-actions' });
    actions.append(cancelBtn, panelBtn, saveBtn);

    dialog.append(
      make('p', { class: 'bb-ref', dir: 'auto' }, reference),
      fieldLabel('bb-save-topic', 'Topic'), topicBox,
      fieldLabel('bb-save-tags', 'Tags'), tagBox,
      fieldLabel('bb-save-body', 'Note'), body,
      error,
      actions,
    );

    const here = {
      dialog, trigger, verses, body, error, saveBtn, topicInput, tagInput, chips,
      topic: UNCATEGORIZED, topics: [], knownTags: [], tags: [], busy: false,
    };
    here.topicList = suggestionList(topicInput, topicRowsEl, topicRows, pickTopic, { autoActive: true });
    here.tagList = suggestionList(tagInput, tagRowsEl, tagRows, pickTag);

    // select() on focus so that typing replaces the name rather than adding to it.
    topicInput.addEventListener('focus', () => { topicInput.select(); here.topicList.open(); });
    topicInput.addEventListener('input', () => here.topicList.open());
    topicInput.addEventListener('keydown', onTopicKey);
    // Puts back the name of the current choice. What was typed was only ever a filter.
    topicInput.addEventListener('blur', () => { topicInput.value = here.topic.name; });

    tagInput.addEventListener('input', () => { if (tagInput.value.trim()) here.tagList.open(); else here.tagList.close(); });
    tagInput.addEventListener('keydown', onTagKey);

    dialog.addEventListener('keydown', onKeydown);
    dialog.addEventListener('mousedown', onMousedown);
    // A close that did not come through onKeydown, such as a device's back gesture. Refused while a
    // save is running, so that a popover cannot go away over a note that is about to exist.
    dialog.addEventListener('cancel', (e) => { if (here.busy) e.preventDefault(); });
    // Only that same kind of close still needs tidying up by the time this arrives. See requestClose.
    dialog.addEventListener('close', () => { if (pop === here) finishClose(); });
    return here;
  }

  // ---------- Opening and closing ----------
  // The tidying up happens here and does not wait for the dialog's own close event. That event is
  // queued, and it arrived 320 ms after close() on live bible.com, measured on 2026-11-10 with the
  // Browser pane in the background. Until it did, pop was still set, so opening again straight away
  // was refused. pop has to outlast close() itself, because the blur that close() fires reads it.
  function requestClose() {
    if (!pop || pop.busy) return;
    pop.dialog.close();
    finishClose();
  }

  // Focus goes to the trigger explicitly as well as natively. The browser restores whatever had focus
  // beforehand, and not every platform focuses a button when it is clicked. If bible.com has closed the
  // menu by then, the trigger is inert or gone and this does nothing.
  function finishClose() {
    const { dialog, trigger } = pop;
    window.removeEventListener('resize', keepInView);
    pop = null;
    dialog.remove();
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }

  // trigger is what opened it, if anything did, for positioning and for giving focus back to.
  //
  // Reading the page goes first and has a guard around it. This all runs off a click on a page that can
  // change shape without warning, and a popover with nothing to save should simply not appear.
  //
  // The note body takes focus because R4 has already picked the topic, so writing is the next thing to
  // do. preventScroll because bible.com scrolls this page for its own reasons, and a focus call should
  // not add to them.
  //
  // showModal puts this in the top layer, above bible.com and the dock with no z-index to get right,
  // and makes the page inert, so a tap on a verse cannot change the selection underneath (R8). The
  // appended root is one childList record, which the T-004 guard ignores because of its marker.
  function open(trigger = null) {
    if (pop) return;
    const selection = getSelection();
    let verses = [];
    try {
      if (selection) verses = readVerses(selection);
    } catch (err) {
      console.debug('[BibleBoost] popover: could not read the selection', err);
    }
    if (!verses.length) {
      console.debug('[BibleBoost] popover: nothing to save', selection);
      return;
    }

    dismissToast();
    pop = build(verses, trigger);
    chooseTopic(UNCATEGORIZED);
    document.body.append(pop.dialog);
    pop.dialog.showModal();
    place();
    pop.body.focus({ preventScroll: true });
    window.addEventListener('resize', keepInView);
    loadLists(pop);
  }

  BB.savePopover = {
    open,
    // For test/save-popover.test.js, which runs this draft through the worker's real validator.
    debug: { readVerses },
  };
})();
