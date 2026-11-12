/*
 * BibleBoost — the note editor
 * Where a note is written and rewritten after it was saved (T-022). The panel opens it in place inside a
 * list row (R1); the notes page (EPIC-03) will give it a pane of its own. Nothing here knows which: the
 * host passes a note, or none for a new one, and is told when the editor wants to close.
 *
 * Four fields, and nothing that needs more room than a narrow panel has: a title, the body as a plain
 * textarea of Markdown source (R9, the formatting toolbar is the full page's), the topic and the tags.
 * The topic and tag fields are the save popover's own combobox (suggest.js), so a note is edited the way
 * it was saved.
 *
 * Nothing is stored until Save (R2 as amended with the user, 2026-11-12). The first build saved as the
 * user typed, and the user's objection was that a slip of the keyboard then replaces the old words at
 * once, with no moment to look at the change and no way back. So typing changes only what is on screen;
 * Save, or Ctrl/Cmd+Enter, stores it, and Cancel, or Escape, puts the note back as it was. Every way out
 * of the editor with changes on screen asks what to do with them, and nothing leaves silently.
 *
 * Only the fields that changed are sent (R3): two surfaces can have one note open, and sending the whole
 * record would put back whatever the other one had just changed. A change made elsewhere to a field that is
 * untouched here is taken in quietly; one to a field that is also being edited here is a conflict, and
 * the editor says so instead of choosing (R8).
 *
 * Built with createElement and textContent (AGENTS.md rule 2): every value here is user content.
 * chrome.* and the DOM are reached only inside functions, so the pure helpers below load and are tested
 * in Node (test/editor.test.js).
 */
import { normalizeTag } from '../../shared/schema.js';
import { fold } from '../../shared/normalize.js';
import { ask, loadLookups, onNotesChange } from './store.js';
import { suggestionList } from './suggest.js';
import { chooseDialog } from './dialog.js';

// The fields this editor owns. Everything else on a note (verses, colour, pinned) it never sends, so a
// patch from here cannot touch them.
export const FIELDS = Object.freeze(['title', 'body', 'topicId', 'tags']);

// A null id is what the schema calls Uncategorized, and there is no such topic row. Shaped like a topic
// so that the picker lists one kind of thing, as the popover's does.
const UNCATEGORIZED = Object.freeze({ id: null, name: 'Uncategorized' });
const NEW_TOPIC_HINT = '+ New topic: type a name';

// ---------- The model ----------
// What the editor edits, from a stored note or from nothing. Tags are kept as given: stored names from a
// note, and whatever was typed for a tag added here, because the spelling a new tag is first typed in is
// the label the worker keeps (repo.js, ensureTags).
export function fieldsOf(note) {
  return {
    title: typeof note?.title === 'string' ? note.title : '',
    body: typeof note?.body === 'string' ? note.body : '',
    topicId: note?.topicId ?? null,
    tags: Array.isArray(note?.tags) ? [...note.tags] : [],
  };
}

// Two tag lists are the same list when they would store the same names. normalizeTag is the worker's own
// rule (schema.js), so "Faith" typed here and "faith" stored there do not count as a change, and a
// decomposed Tamil tag matches its composed self.
function sameTags(a, b) {
  const x = [...new Set(a.map(normalizeTag).filter(Boolean))].sort();
  const y = [...new Set(b.map(normalizeTag).filter(Boolean))].sort();
  return x.length === y.length && x.every((name, i) => name === y[i]);
}

export const sameField = (field, a, b) => (field === 'tags' ? sameTags(a, b) : a === b);

// R3. Only what differs from the stored state, so a patch of { body } cannot carry an old title along
// with it. Title and body are compared exactly: the worker stores them as sent, so anything else would
// either miss an edit or report one that is not there.
export function diffPatch(base, local) {
  const patch = {};
  for (const field of FIELDS) {
    if (!sameField(field, base[field], local[field])) patch[field] = field === 'tags' ? [...local.tags] : local[field];
  }
  return patch;
}

// The worker refuses a draft with neither a verse nor some text (schema.js, cleanNoteDraft), and a note
// made here has no verse, so it can be created once its body has something in it. trim() knows Unicode
// whitespace, as the worker's test does.
export const canCreate = (local) => local.body.trim() !== '';

// Whether throwing a new note away loses anything somebody typed (R7). A topic picked and nothing else is
// not counted: the choice takes one click to make again.
export const hasContent = (local) => local.title.trim() !== '' || local.body.trim() !== '' || local.tags.length > 0;

// Whether there is anything on screen that Save would store. For a new note that is anything typed, and
// for a stored one any field that differs from what is stored.
export const isDirty = (base, local, isNew) => (isNew ? hasContent(local) : Object.keys(diffPatch(base, local)).length > 0);

// R8. base is the stored state as this editor last knew it, local what is on screen, remote the stored
// state now. For each field the other surface changed:
//   untouched here   -> take theirs, quietly
//   changed here too -> a conflict, unless both made the same change
// The new base is theirs either way, so that once a conflict is settled in favour of what is on screen,
// Save sends exactly the fields that differ from what is stored now.
export function mergeRemote(base, local, remote) {
  const next = { base: { ...base }, local: { ...local }, conflicts: [] };
  for (const field of FIELDS) {
    if (sameField(field, base[field], remote[field])) continue;
    next.base[field] = remote[field];
    if (sameField(field, local[field], base[field])) next.local[field] = remote[field];
    else if (!sameField(field, local[field], remote[field])) next.conflicts.push(field);
  }
  return next;
}

// ---------- Small helpers ----------
let editorCount = 0;

function make(tag, attrs = {}, text) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  if (text !== undefined) el.textContent = text;
  return el;
}

function button(text, attrs = {}) {
  return make('button', { type: 'button', class: 'bb-btn', ...attrs }, text);
}

// A value written into a field the user is in keeps the caret where it was, as near as the new text
// allows. Without this, a change taken in from elsewhere would throw the caret to the end mid-sentence.
function setValue(field, value) {
  if (field.value === value) return;
  if (document.activeElement !== field) {
    field.value = value;
    return;
  }
  const { selectionStart, selectionEnd } = field;
  field.value = value;
  field.setSelectionRange(Math.min(selectionStart, value.length), Math.min(selectionEnd, value.length));
}

// ---------- The editor ----------
// note is the note to edit, or null for a new one, which is created on Save with source as its origin.
// lookups, if the host has them, are the topic and tag maps loadLookups() returns, so the topic's name
// shows at once; the editor fetches its own as well.
//
// onClose({ focus, saved }) is called once, when the editor is done; the host takes it off screen. focus
// says whether the host should give focus to the note it showed, and saved is the stored note when the
// editor closed by saving, or null.
//
// close() takes how the editor is being left, and resolves to true once it has closed, or false if the
// user chose to stay or a save failed:
//   'save'     store the changes, then close; stay open with the error if that fails
//   'cancel'   drop the changes, asking first if there are any
//   'ask'      the editor is being left for something else: Save, Discard or Keep editing
//   'discard'  drop the changes without asking, for a note that is about to go to Trash anyway
export function createEditor({ note = null, source = 'panel', lookups: given = null, onClose = () => {} } = {}) {
  editorCount += 1;
  const n = editorCount;

  let id = note?.id ?? null;
  let base = fieldsOf(note);
  let local = fieldsOf(note);
  let lookups = given ?? { topics: new Map(), tags: new Map() };
  let topics = [...lookups.topics.values()];

  // Saves and the conflict checks share one queue, so that a check never reads the note while this
  // editor's own write is half way, and a second Save never starts from a stale base.
  let tail = Promise.resolve();
  let saving = false;
  let error = null;
  const conflicts = new Set();
  let closing = null;
  let closed = false;

  const dirty = () => isDirty(base, local, !id);

  // ---------- Building it ----------
  const el = make('div', { class: 'bb-editor' });

  const title = make('input', { class: 'bb-ed-title', type: 'text', dir: 'auto', autocomplete: 'off', placeholder: 'Title (optional)', 'aria-label': 'Title' });
  const body = make('textarea', { class: 'bb-ed-body', dir: 'auto', rows: '6', placeholder: 'Write a note (Markdown)', 'aria-label': 'Note' });

  const topicId = `bb-ed-topic-${n}`;
  const topicInput = make('input', { id: topicId, class: 'bb-ed-input', type: 'text', dir: 'auto', autocomplete: 'off', spellcheck: 'false', placeholder: 'Find or create a topic' });
  const topicRowsEl = make('ul', { id: `${topicId}-list`, class: 'bb-suggest' });
  const topicBox = make('div', { class: 'bb-combo' });
  topicBox.append(topicInput, topicRowsEl);

  const tagsId = `bb-ed-tags-${n}`;
  const chips = make('span', { class: 'bb-chips' });
  const tagInput = make('input', { id: tagsId, class: 'bb-ed-tag', type: 'text', dir: 'auto', autocomplete: 'off', spellcheck: 'false', placeholder: 'Add a tag' });
  const tagRowsEl = make('ul', { id: `${tagsId}-list`, class: 'bb-suggest' });
  const tagField = make('div', { class: 'bb-tagbox' });
  tagField.append(chips, tagInput);
  const tagBox = make('div', { class: 'bb-combo' });
  tagBox.append(tagField, tagRowsEl);

  const meta = make('div', { class: 'bb-ed-meta' });
  meta.append(
    make('label', { for: topicId }, 'Topic'), topicBox,
    make('label', { for: tagsId }, 'Tags'), tagBox,
  );

  // R8's notice. role=alert because it is news about the user's own words, and it does not take focus,
  // so typing carries on through it.
  const notice = make('div', { class: 'bb-ed-notice', role: 'alert' });
  notice.hidden = true;
  const noticeText = make('span', {}, 'This note was changed elsewhere while you were editing it.');
  const reloadBtn = button('Reload', { title: 'Show the version saved elsewhere, and drop your change to it' });
  const keepBtn = button('Keep mine', { title: 'Keep your version on screen. Save will store it over theirs' });
  const noticeActions = make('span', { class: 'bb-ed-notice-actions' });
  noticeActions.append(reloadBtn, keepBtn);
  notice.append(noticeText, noticeActions);

  // A failed save says so where it can be heard, and stays until a save works. The editor never claims a
  // note is saved after a failure (T-030 R7's rule starts here).
  const alert = make('p', { class: 'bb-ed-error', role: 'alert' });
  alert.hidden = true;

  // Save is the primary button, and the other one reads Close while there is nothing to lose and Cancel
  // once there is, so the word always says what it will do.
  const status = make('span', { class: 'bb-ed-status' });
  const cancelBtn = button('Close', { title: 'Close without saving (Esc)' });
  const saveBtn = button('Save', { 'data-bb-primary': '', title: 'Save (Ctrl+Enter)' });
  const buttons = make('span', { class: 'bb-ed-buttons' });
  buttons.append(cancelBtn, saveBtn);
  const foot = make('div', { class: 'bb-ed-foot' });
  foot.append(status, buttons);

  el.append(title, body, meta, notice, alert, foot);

  // ---------- Showing the state ----------
  // Quiet: one short phrase in the secondary colour. Unsaved changes are named, so that nobody thinks a
  // change is stored before they have pressed Save.
  //
  // Save is aria-disabled, not disabled, while there is nothing it could store: a disabled button drops
  // focus as it is pressed, and Ctrl+Enter from a field would then have nowhere to come back to.
  function showStatus() {
    alert.hidden = !error;
    alert.textContent = error ?? '';
    const changed = dirty();
    let word = '';
    if (saving) word = 'Saving…';
    else if (conflicts.size) word = 'Changed elsewhere';
    else if (!id && hasContent(local) && !canCreate(local)) word = 'Write some text to save this note';
    else if (changed) word = 'Unsaved changes';
    status.textContent = word;
    cancelBtn.textContent = changed ? 'Cancel' : 'Close';
    cancelBtn.title = changed ? 'Put the note back as it was (Esc)' : 'Close (Esc)';
    saveBtn.setAttribute('aria-disabled', String(!changed || saving || (!id && !canCreate(local))));
  }

  const topicName = (value) => (value == null ? UNCATEGORIZED.name : (lookups.topics.get(value)?.name ?? 'Topic'));
  const tagLabel = (tag) => lookups.tags.get(normalizeTag(tag))?.label || tag;

  function drawChips() {
    chips.replaceChildren(...local.tags.map((tag) => {
      const label = tagLabel(tag);
      const chip = make('span', { class: 'bb-chip' }, label);
      const remove = make('button', { type: 'button', 'aria-label': `Remove tag ${label}`, title: `Remove ${label}` }, '×');
      remove.addEventListener('click', () => removeTag(tag));
      chip.append(remove);
      return chip;
    }));
  }

  // Writes the model into the fields, for the fields named. The topic field is left alone while it is
  // in use, because what is in it then is a filter being typed, not the choice.
  function render(fields = FIELDS) {
    if (fields.includes('title')) setValue(title, local.title);
    if (fields.includes('body')) setValue(body, local.body);
    if (fields.includes('topicId') && document.activeElement !== topicInput) topicInput.value = topicName(local.topicId);
    if (fields.includes('tags')) drawChips();
    showStatus();
  }

  // ---------- Saving ----------
  // Resolves to the stored note, or to null when there was nothing to store or it could not be, in which
  // case the error is on screen and the changes are still there.
  function save() {
    const run = async () => {
      if (closed) return null;
      if (!id) return create();
      const patch = diffPatch(base, local);
      if (!Object.keys(patch).length) return null;
      saving = true;
      showStatus();
      const reply = await ask({ type: 'notes/update', id, patch });
      saving = false;
      if (!reply.ok) return fail(reply.error);
      return stored(reply.note);
    };
    const job = tail.then(run, run);
    tail = job.catch(() => {});
    return job;
  }

  async function create() {
    if (!canCreate(local)) {
      showStatus();
      return null;
    }
    saving = true;
    showStatus();
    const reply = await ask({ type: 'notes/create', draft: { source, ...local, tags: [...local.tags] } });
    saving = false;
    if (!reply.ok) return fail(reply.error);
    id = reply.note.id;
    return stored(reply.note);
  }

  // error is the whole sentence shown, so that a topic that could not be made does not read as a note
  // that could not be saved.
  function fail(message, what = 'Not saved.') {
    error = `${what} ${message}`;
    showStatus();
    return null;
  }

  function stored(saved) {
    error = null;
    conflicts.clear();
    notice.hidden = true;
    base = fieldsOf(saved);
    local = fieldsOf(saved);
    render();
    return saved;
  }

  // ---------- Changes from elsewhere (R8) ----------
  function applyRemote(remote) {
    const merged = mergeRemote(base, local, remote);
    const taken = FIELDS.filter((f) => merged.local[f] !== local[f]);
    base = merged.base;
    local = merged.local;
    for (const field of merged.conflicts) conflicts.add(field);
    notice.hidden = !conflicts.size;
    render(taken);
  }

  // Queued behind any save, so that an echo of this editor's own write is read after that write has
  // landed, and then matches the base and changes nothing.
  function checkRemote() {
    const run = async () => {
      if (closed || !id) return;
      const reply = await ask({ type: 'notes/get', id });
      if (reply.ok && reply.note && !closed) applyRemote(fieldsOf(reply.note));
    };
    tail = tail.then(run, run).catch(() => {});
  }

  // Reload takes the stored version of every field in conflict. Keep mine leaves the screen as it is:
  // base already holds theirs, so Save will send exactly what differs from it.
  reloadBtn.addEventListener('click', () => {
    for (const field of conflicts) local[field] = Array.isArray(base[field]) ? [...base[field]] : base[field];
    const fields = [...conflicts];
    conflicts.clear();
    notice.hidden = true;
    render(fields);
    body.focus({ preventScroll: true });
  });

  keepBtn.addEventListener('click', () => {
    conflicts.clear();
    notice.hidden = true;
    showStatus();
    body.focus({ preventScroll: true });
  });

  async function refreshLookups() {
    lookups = await loadLookups(lookups);
    const listed = new Set(lookups.topics.keys());
    topics = [...lookups.topics.values(), ...topics.filter((t) => !listed.has(t.id) && t.id)];
    render(['topicId', 'tags']);
    topicList.refresh();
  }

  // A trash or purge is the host's to notice, since it takes the note off the list. A topic or tag change
  // can rewrite this note too (a tag renamed, a topic deleted with its notes reassigned), and the worker
  // reports those writes by kind with no note ids, so the note is read again whenever one comes.
  const stopListening = onNotesChange(({ kind, ids }) => {
    if (closed) return;
    if (kind === 'topics' || kind === 'tags') {
      refreshLookups();
      checkRemote();
    } else if ((kind === 'update' || kind === 'restore') && id && ids.includes(id)) {
      checkRemote();
    }
  });

  // ---------- Topic ----------
  // As in the popover: every topic while the field still reads as the current choice, filtered once
  // something is typed, with the way to make one always in sight at the end.
  function topicRows(value) {
    const name = value.trim();
    const filter = name && name !== topicName(local.topicId) ? fold(name) : '';
    const rows = [UNCATEGORIZED, ...topics]
      .filter((t) => fold(t.name).includes(filter))
      .map((topic) => ({ label: topic.name, topic, current: !filter && topic.id === local.topicId }));
    const canMake = filter && !rows.some((r) => fold(r.label) === filter);
    rows.push(canMake ? { label: `+ New topic "${name}"`, create: name } : { label: NEW_TOPIC_HINT, hint: true });
    return rows;
  }

  function chooseTopic(topic) {
    topicInput.value = topic.name;
    local.topicId = topic.id;
    showStatus();
  }

  // A new topic is made at once, as the popover does: it is a topic, not a change to this note, and the
  // note is only moved into it when Save is pressed.
  async function pickTopic(row) {
    topicList.close();
    if (!row.create) return chooseTopic(row.topic);
    const reply = await ask({ type: 'topics/create', name: row.create });
    if (!reply.ok) return fail(reply.error, 'Could not create that topic.');
    topics.push(reply.topic);
    lookups.topics.set(reply.topic.id, reply.topic);
    chooseTopic(reply.topic);
  }

  const topicList = suggestionList(topicInput, topicRowsEl, topicRows, pickTopic, { autoActive: true });

  // select() on focus so that typing replaces the name rather than adding to it, and the name of the
  // choice comes back on blur, since what was typed was only ever a filter.
  topicInput.addEventListener('focus', () => { topicInput.select(); topicList.open(); });
  topicInput.addEventListener('input', () => topicList.open());
  topicInput.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (topicList.onKey(e) && e.key === 'Escape') topicInput.value = topicName(local.topicId);
  });
  topicInput.addEventListener('blur', () => { topicInput.value = topicName(local.topicId); });

  // ---------- Tags ----------
  // A chip holds what was typed, and the worker settles the spelling. Comparing here only stops two
  // chips appearing for what would be one tag.
  function addTag(raw) {
    const tag = raw.trim();
    tagInput.value = '';
    if (!tag || local.tags.some((t) => normalizeTag(t) === normalizeTag(tag))) return;
    local.tags = [...local.tags, tag];
    drawChips();
    showStatus();
  }

  // Focus goes back to the input, since the button that held it has just been removed.
  function removeTag(tag) {
    local.tags = local.tags.filter((t) => t !== tag);
    drawChips();
    tagInput.focus();
    showStatus();
  }

  function tagRows(value) {
    const query = fold(value.trim());
    return [...lookups.tags.values()]
      .filter(({ label }) => fold(label).includes(query) && !local.tags.some((t) => normalizeTag(t) === normalizeTag(label)))
      .map(({ label }) => ({ label }));
  }

  const tagList = suggestionList(tagInput, tagRowsEl, tagRows, (row) => { addTag(row.label); tagList.close(); });

  // isComposing because a Tamil input method confirms with Enter, and taking that Enter as "this is the
  // tag" would store half a word.
  tagInput.addEventListener('input', () => { if (tagInput.value.trim()) tagList.open(); else tagList.close(); });
  tagInput.addEventListener('keydown', (e) => {
    if (e.isComposing || tagList.onKey(e)) return;
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      addTag(tagInput.value);
      tagList.close();
    } else if (e.key === 'Backspace' && !tagInput.value && local.tags.length) {
      removeTag(local.tags.at(-1));
    }
  });
  // A tag typed and left without Enter becomes a chip when the field is left, so it is on screen, and
  // counted as a change, before anyone presses Save. A click on a suggestion does not blur the field
  // (suggest.js), so this never turns half a word into a tag.
  tagInput.addEventListener('blur', () => addTag(tagInput.value));

  // ---------- Title and body ----------
  title.addEventListener('input', () => { local.title = title.value; showStatus(); });
  body.addEventListener('input', () => { local.body = body.value; showStatus(); });

  // ---------- Buttons and keys (R10) ----------
  // Ctrl or Cmd with Enter saves and closes; Escape puts the note back and closes, asking first when that
  // would drop a change. An Escape that a suggestion list used has been stopped before it gets here.
  // isComposing because an input method uses both keys for itself, and e.repeat because a held Ctrl+Enter
  // repeats.
  el.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close({ how: 'cancel' });
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) close({ how: 'save' });
    }
  });
  saveBtn.addEventListener('click', () => {
    if (saveBtn.getAttribute('aria-disabled') !== 'true') close({ how: 'save' });
  });
  cancelBtn.addEventListener('click', () => close({ how: 'cancel' }));

  // ---------- Closing ----------
  // Nothing on screen is ever dropped without the user saying so: Cancel asks when there are changes, and
  // leaving for another note offers Save as well. A new note with words but no text cannot be stored, so
  // its only choices are to keep editing or to discard it. A tag still being typed counts as typed.
  async function decide(how) {
    if (tagInput.value.trim()) addTag(tagInput.value);
    if (how === 'discard' || !dirty()) return how === 'save' && !id ? 'stay' : 'drop';
    if (how === 'save') return 'save';
    const storable = id || canCreate(local);
    if (how === 'cancel') {
      return (await chooseDialog({
        title: id ? 'Discard your changes?' : 'Discard this note?',
        message: id ? 'The note goes back to how it was before you edited it.' : storable ? 'It has not been saved.' : 'It has no text yet, so it cannot be saved.',
        choices: [{ value: 'stay', label: 'Keep editing' }, { value: 'drop', label: 'Discard', kind: 'danger' }],
        cancel: 'stay',
      }));
    }
    if (!storable) {
      return (await chooseDialog({
        title: 'Discard this note?',
        message: 'It has no text yet, so it cannot be saved.',
        choices: [{ value: 'stay', label: 'Keep editing' }, { value: 'drop', label: 'Discard', kind: 'danger' }],
        cancel: 'stay',
      }));
    }
    return (await chooseDialog({
      title: id ? 'Save your changes?' : 'Save this note?',
      message: id ? 'You changed this note and have not saved it yet.' : 'You have not saved it yet.',
      choices: [
        { value: 'stay', label: 'Keep editing' },
        { value: 'drop', label: 'Discard', kind: 'danger' },
        { value: 'save', label: 'Save', kind: 'primary' },
      ],
      cancel: 'stay',
      focus: 'save',
    }));
  }

  function finish({ focus, saved }) {
    closed = true;
    stopListening();
    onClose({ focus, saved });
    return true;
  }

  function close({ how = 'ask', focus = true } = {}) {
    if (closed) return Promise.resolve(true);
    closing ??= (async () => {
      const choice = await decide(how);
      if (choice === 'save') {
        const saved = await save();
        if (saved) return finish({ focus, saved });
        closing = null;
        if (!dirty()) return finish({ focus, saved: null });
        body.focus({ preventScroll: true });
        return false;
      }
      if (choice === 'drop') return finish({ focus, saved: null });
      closing = null;
      showStatus();
      body.focus({ preventScroll: true });
      return false;
    })();
    return closing;
  }

  // ---------- Start ----------
  render();
  refreshLookups();
  // The note may have changed between the list drawing it and this editor opening.
  if (id) checkRemote();

  return {
    el,
    close,
    get id() { return id; },
    get dirty() { return dirty(); },
    // The body takes focus, with the caret at the end, because writing is what opening a note is for.
    focus() {
      body.focus({ preventScroll: true });
      body.setSelectionRange(body.value.length, body.value.length);
    },
  };
}
