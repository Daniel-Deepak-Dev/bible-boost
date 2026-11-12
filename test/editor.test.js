/*
 * src/ui/app/editor.js — what an autosave sends, and how a change from elsewhere is taken in (T-022 R3,
 * R8). Also the messages of src/ui/app/trash.js.
 *
 * The editor itself is DOM and stays a manual check (test/README.md). Importing editor.js, toast.js,
 * dialog.js, suggest.js and trash.js here is itself a check that they reach the DOM and chrome.* only
 * inside their functions.
 *
 * Every patch and draft goes through the worker's own cleaners, as save-popover.test.js does with the
 * popover's drafts, so that a field named differently on the two sides fails here and not as a save
 * that does nothing on a live page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanNoteDraft, cleanNotePatch } from '../src/shared/schema.js';
import { fieldsOf, diffPatch, canCreate, hasContent, isDirty, mergeRemote, FIELDS } from '../src/ui/app/editor.js';
import { trashedMessage, restoredMessage } from '../src/ui/app/trash.js';
import '../src/ui/app/toast.js';
import '../src/ui/app/dialog.js';
import '../src/ui/app/suggest.js';

const wire = (value) => JSON.parse(JSON.stringify(value));

const stored = {
  id: 'n_1',
  title: 'Firstborn',
  body: 'Consecrate to Me all the firstborn',
  topicId: 't_1',
  tags: ['exodus', 'faith'],
  verses: [{ usfm: 'EXO.13.2' }],
  updatedAt: 1,
};

// கொ written two ways: composed, and as its two vowel-sign halves. Escapes, so that an editor that
// normalizes on save cannot quietly turn one into the other (01-code-style.md).
const KO_NFC = '\u0B95\u0BCA';
const KO_NFD = '\u0B95\u0BC6\u0BBE';

test('the two Tamil spellings really differ before normalization', () => {
  assert.notEqual(KO_NFC, KO_NFD);
  assert.equal(KO_NFD.normalize('NFC'), KO_NFC);
});

test('fieldsOf takes only the four fields the editor owns', () => {
  assert.deepEqual(Object.keys(fieldsOf(stored)), [...FIELDS]);
  assert.deepEqual(fieldsOf(null), { title: '', body: '', topicId: null, tags: [] });
});

test('fieldsOf copies the tags, so editing them cannot reach into the note', () => {
  const fields = fieldsOf(stored);
  fields.tags.push('hope');
  assert.deepEqual(stored.tags, ['exodus', 'faith']);
});

// R3: a patch, never the whole record.
test('diffPatch sends only the field that changed', () => {
  const base = fieldsOf(stored);
  assert.deepEqual(diffPatch(base, { ...base, body: 'Sanctify unto me' }), { body: 'Sanctify unto me' });
  assert.deepEqual(diffPatch(base, { ...base, topicId: null }), { topicId: null });
});

test('diffPatch sends nothing when nothing changed', () => {
  const base = fieldsOf(stored);
  assert.deepEqual(diffPatch(base, fieldsOf(stored)), {});
});

test('diffPatch does not count a different spelling of the same tags as a change', () => {
  const base = { ...fieldsOf(stored), tags: ['faith', `${KO_NFC}டு`] };
  assert.deepEqual(diffPatch(base, { ...base, tags: ['Faith ', `${KO_NFD}டு`] }), {});
  assert.deepEqual(diffPatch(base, { ...base, tags: [`${KO_NFC}டு`, 'faith'] }), {});
});

test('diffPatch sends the whole tag list when one tag is added', () => {
  const base = fieldsOf(stored);
  assert.deepEqual(diffPatch(base, { ...base, tags: [...base.tags, 'Hope'] }), { tags: ['exodus', 'faith', 'Hope'] });
});

test('title and body are compared exactly, since the worker stores them as sent', () => {
  const base = fieldsOf(stored);
  assert.deepEqual(diffPatch(base, { ...base, title: 'Firstborn ' }), { title: 'Firstborn ' });
});

test('a patch passes the worker validator and changes only its own fields', () => {
  const base = fieldsOf(stored);
  const patch = wire(diffPatch(base, { ...base, body: 'New words', tags: ['Faith', 'Hope'] }));
  const { fields, tagEntries } = cleanNotePatch(patch);
  assert.deepEqual(Object.keys(fields).sort(), ['body', 'tags']);
  assert.deepEqual(fields.tags, ['faith', 'hope']);
  assert.deepEqual(tagEntries.map((t) => t.label), ['Faith', 'Hope']);
});

// R4: a standalone note has no verse, so it needs some text before the worker will take it.
test('a new note with text passes the worker validator as a panel draft', () => {
  const draft = wire({ source: 'panel', ...fieldsOf(null), body: 'A thought with no verse', title: 'Note' });
  assert.equal(cleanNoteDraft(draft).fields.source, 'panel');
});

test('canCreate agrees with the worker about a blank body, in every script', () => {
  for (const body of ['', '   ', '\n\t', ' 　']) {
    const local = { ...fieldsOf(null), body };
    assert.equal(canCreate(local), false, JSON.stringify(body));
    assert.throws(() => cleanNoteDraft({ source: 'panel', ...local }), /needs at least a verse or some text/);
  }
  assert.equal(canCreate({ ...fieldsOf(null), body: KO_NFC }), true);
});

// R7: discarding a new note asks only when something typed would be lost.
test('hasContent counts a title, a body or a tag, and not a topic alone', () => {
  const empty = fieldsOf(null);
  assert.equal(hasContent(empty), false);
  assert.equal(hasContent({ ...empty, topicId: 't_1' }), false);
  assert.equal(hasContent({ ...empty, title: 'Plan' }), true);
  assert.equal(hasContent({ ...empty, tags: ['faith'] }), true);
  assert.equal(hasContent({ ...empty, body: 'x' }), true);
  assert.equal(hasContent({ ...empty, title: '  ' }), false);
});

// R2 as amended: nothing is stored until Save, so whether there is anything to lose decides every way
// out of the editor.
test('isDirty: a stored note has changes only where a field differs from what is stored', () => {
  const base = fieldsOf(stored);
  assert.equal(isDirty(base, fieldsOf(stored), false), false);
  assert.equal(isDirty(base, { ...base, body: 'changed' }, false), true);
  assert.equal(isDirty(base, { ...base, tags: ['Faith', 'EXODUS'] }, false), false);
  assert.equal(isDirty(base, { ...base, topicId: null }, false), true);
});

test('isDirty: a new note has changes as soon as anything is typed in it', () => {
  const empty = fieldsOf(null);
  assert.equal(isDirty(empty, empty, true), false);
  assert.equal(isDirty(empty, { ...empty, title: 'Only a title' }, true), true);
  assert.equal(isDirty(empty, { ...empty, topicId: 't_1' }, true), false);
});

// R8.
test('a change elsewhere to a field untouched here is taken in quietly', () => {
  const base = fieldsOf(stored);
  const local = { ...base, body: 'my unsaved words' };
  const remote = { ...base, title: 'Renamed elsewhere' };
  const merged = mergeRemote(base, local, remote);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.local.title, 'Renamed elsewhere');
  assert.equal(merged.local.body, 'my unsaved words');
  assert.deepEqual(diffPatch(merged.base, merged.local), { body: 'my unsaved words' });
});

test('a change elsewhere to a field being edited here is a conflict, and nothing is overwritten', () => {
  const base = fieldsOf(stored);
  const local = { ...base, body: 'mine' };
  const remote = { ...base, body: 'theirs' };
  const merged = mergeRemote(base, local, remote);
  assert.deepEqual(merged.conflicts, ['body']);
  assert.equal(merged.local.body, 'mine');
  assert.equal(merged.base.body, 'theirs');
  // Keep mine then sends exactly the conflicting field.
  assert.deepEqual(diffPatch(merged.base, merged.local), { body: 'mine' });
});

test('the same change made on both sides is not a conflict', () => {
  const base = fieldsOf(stored);
  const both = { ...base, body: 'the same words' };
  const merged = mergeRemote(base, both, { ...both });
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(diffPatch(merged.base, merged.local), {});
});

test('the echo of this editor\'s own save changes nothing', () => {
  const base = { ...fieldsOf(stored), tags: ['Exodus', 'Faith'] };
  const remote = fieldsOf(stored);
  const merged = mergeRemote(base, { ...base }, remote);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.local, base);
});

test('a tag change elsewhere is taken in while the body is being edited', () => {
  const base = fieldsOf(stored);
  const local = { ...base, body: 'typing' };
  const merged = mergeRemote(base, local, { ...base, tags: ['exodus', 'trust'] });
  assert.deepEqual(merged.local.tags, ['exodus', 'trust']);
  assert.deepEqual(merged.conflicts, []);
});

test('trash messages carry the count', () => {
  assert.equal(trashedMessage(1), 'Note moved to Trash');
  assert.equal(trashedMessage(3), '3 notes moved to Trash');
  assert.equal(restoredMessage(1, 0), 'Note restored');
  assert.equal(restoredMessage(3, 0), '3 notes restored');
  assert.match(restoredMessage(1, 1), /Uncategorized/);
  assert.match(restoredMessage(3, 1), /^3 notes restored\. 1 went to Uncategorized/);
});
