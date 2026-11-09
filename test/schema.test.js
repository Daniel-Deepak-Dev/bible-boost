/*
 * src/shared/schema.js — the schema version, the id generator and the record defaults.
 *
 * Importing the module here is itself a test: it must load in plain Node, which fails at once if
 * anyone adds a chrome.* or document reference to a shared file (T-007 R3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION, newId, NOTE_DEFAULTS, TOPIC_DEFAULTS, TAG_DEFAULTS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE,
  normalizeTag, compareText, cleanId, cleanIds, cleanTags, cleanTagEntry, retag, deriveVerseKeys,
  cleanNoteDraft, cleanNotePatch, cleanNoteFilter, cleanNoteSort, cleanPage,
  slugify, cleanTopicDraft, cleanTopicPatch,
} from '../src/shared/schema.js';

test('SCHEMA_VERSION is 1', () => {
  assert.equal(SCHEMA_VERSION, 1);
});

// ---------- newId ----------
test('newId is prefix, 8 base-36 time characters, 8 hex characters', () => {
  assert.match(newId('n'), /^n_[0-9a-z]{8}[0-9a-f]{8}$/);
  assert.match(newId('t'), /^t_[0-9a-z]{8}[0-9a-f]{8}$/);
});

test('newId does not repeat', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => newId('n')));
  assert.equal(ids.size, 1000);
});

// Plain string order must equal creation order. It does because base-36 digits 0-9a-z are also in
// ascending ASCII order, and the time part is a fixed 8 characters from 1972 until 2059. The times
// below are 1 ms apart across a 'z' -> '10' carry in the last two digits, plus a date near each end
// of that window, created out of order on purpose.
test('newId sorts by creation time', (t) => {
  const base = Date.UTC(2026, 10, 8);
  const carry = base - (base % 36 ** 2) + 36 ** 2; // the next time whose last two digits are "00"
  const times = [carry, base, Date.UTC(2059, 0, 1), carry - 1, carry + 1, Date.UTC(1973, 0, 1)];
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  const made = times.map((ms) => { now = ms; return { ms, id: newId('n') }; });
  const byId = [...made].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((x) => x.ms);
  const byTime = [...made].sort((a, b) => a.ms - b.ms).map((x) => x.ms);
  assert.deepEqual(byId, byTime);
});

// A record's id and createdAt share one clock reading, or key order can disagree with createdAt.
test('newId can be given the time, and then uses exactly that', () => {
  const at = Date.UTC(2026, 10, 9);
  assert.equal(parseInt(newId('n', at).slice(2, 10), 36), at);
});

// ---------- Record defaults ----------
// Frozen all the way down: a spread copies the array REFERENCE, so an unfrozen tags: [] would let
// one note's push leak into every later note.
test('record defaults are frozen, arrays included', () => {
  for (const d of [NOTE_DEFAULTS, TOPIC_DEFAULTS, TAG_DEFAULTS]) assert.ok(Object.isFrozen(d));
  for (const k of ['tags', 'verses', 'verseKeys']) {
    assert.ok(Object.isFrozen(NOTE_DEFAULTS[k]), k);
    assert.throws(() => NOTE_DEFAULTS[k].push('x'), TypeError, k);
  }
});

test('a spread copy is a normal, writable record', () => {
  const note = { ...NOTE_DEFAULTS, title: 'Passover' };
  note.pinned = true;
  assert.equal(note.title, 'Passover');
  assert.equal(note.topicId, null); // Uncategorized
  assert.deepEqual(note.tags, []);
});

test('defaults carry no id, timestamps or source', () => {
  for (const k of ['id', 'createdAt', 'updatedAt', 'source']) {
    assert.ok(!(k in NOTE_DEFAULTS), k);
  }
});

// ---------- Tag normalization (R2) ----------
// Real Tamil: the vowel sign "ொ" as one code point (U+0BCA) and as its two parts (U+0BC6 U+0BBE).
// They render identically and compare unequal until NFC, which is the whole bug.
const TAMIL_COMPOSED = 'கொடு'; // கொடு
const TAMIL_DECOMPOSED = 'கொடு';

test('Tamil composed and decomposed forms are one tag', () => {
  assert.notEqual(TAMIL_COMPOSED, TAMIL_DECOMPOSED);
  assert.equal(normalizeTag(TAMIL_DECOMPOSED), normalizeTag(TAMIL_COMPOSED));
  assert.equal(normalizeTag(TAMIL_DECOMPOSED), TAMIL_COMPOSED);
});

test('case and outer whitespace do not make a different tag', () => {
  assert.equal(normalizeTag('  FaIth '), 'faith');
});

// toLowerCase looks identical in English testing, so only an explicit check can hold this line.
test('normalizing never calls toLowerCase', (t) => {
  t.mock.method(String.prototype, 'toLowerCase', () => assert.fail('toLowerCase was called'));
  assert.equal(normalizeTag('Faith'), 'faith');
  assert.equal(slugify('Faith'), 'faith');
});

test('anything that is not a string is no tag', () => {
  for (const v of [undefined, null, 7, {}, []]) assert.equal(normalizeTag(v), '');
});

test('Faith, faith and FAITH collapse to one tag labelled with the first casing', () => {
  assert.deepEqual(cleanTags(['Faith', 'faith', 'FAITH']), [{ name: 'faith', label: 'Faith' }]);
});

test('tags are sorted by collation: numerically, not by code point', () => {
  assert.deepEqual(cleanTags(['psalm 10', 'Zion', 'psalm 9', 'exodus']).map((t) => t.name), ['exodus', 'psalm 9', 'psalm 10', 'zion']);
});

test('the order tags were typed in cannot change the result', () => {
  const names = (list) => cleanTags(list).map((t) => t.name);
  assert.deepEqual(names(['résumé', 'resume', 'Résumé']), names(['resume', 'résumé']));
});

test('compareText is a total order, even between strings the collator calls equal', () => {
  assert.notEqual(compareText('resume', 'résumé'), 0);
  assert.equal(compareText('a', 'a'), 0);
});

test('a blank tag is dropped, and a label keeps its casing but not its spaces', () => {
  assert.deepEqual(cleanTags(['  ', '', ' Hope ']), [{ name: 'hope', label: 'Hope' }]);
});

test('a label is stored in NFC', () => {
  assert.equal(cleanTags([TAMIL_DECOMPOSED])[0].label, TAMIL_COMPOSED);
});

test('something that is not a list of strings is refused', () => {
  assert.throws(() => cleanTags('faith'), /must be a list/);
  assert.throws(() => cleanTags([7]), /must be text/);
});

test('a tag entry needs a name', () => {
  assert.deepEqual(cleanTagEntry(' Faith '), { name: 'faith', label: 'Faith' });
  assert.throws(() => cleanTagEntry('   '), /needs a name/);
});

test('retag swaps, merges duplicates, and adds nothing to a note without the source', () => {
  assert.deepEqual(retag(['faith', 'hope'], ['faith'], 'trust'), ['hope', 'trust']);
  assert.deepEqual(retag(['faith', 'trust'], ['faith'], 'trust'), ['trust']);
  assert.deepEqual(retag(['a', 'b', 'c'], ['a', 'b'], 'z'), ['c', 'z']);
  assert.deepEqual(retag(['hope'], ['faith'], 'trust'), ['hope']);
});

test('retag with no target just removes', () => {
  assert.deepEqual(retag(['faith', 'hope'], ['faith']), ['hope']);
});

// ---------- Ids ----------
test('an id must be a non-empty string', () => {
  assert.equal(cleanId('n_1'), 'n_1');
  for (const v of ['', null, undefined, 7, {}]) assert.throws(() => cleanId(v), /not valid/);
});

test('an id list is deduped, and an empty one is refused', () => {
  assert.deepEqual(cleanIds(['a', 'b', 'a']), ['a', 'b']);
  assert.throws(() => cleanIds([]), /No notes/);
  assert.throws(() => cleanIds('a'), /No notes/);
  assert.throws(() => cleanIds([7]), /not valid/);
});

// ---------- Note drafts (R2, R3) ----------
const verse = (usfm, extra = {}) => ({
  usfm,
  primary: { versionId: '339', abbr: 'TAOVBSI', lang: 'tam', text: 'வசனம்' },
  ...extra,
});

const clean = (draft) => cleanNoteDraft({ source: 'page', ...draft });

test('a draft with no verses and no body is rejected with a clear error', () => {
  assert.throws(() => clean({}), /at least a verse or some text/);
  assert.throws(() => clean({ verses: [] }), /at least a verse or some text/);
  assert.throws(() => clean({ body: '   \n ' }), /at least a verse or some text/);
});

test('verses alone or a body alone is enough', () => {
  assert.doesNotThrow(() => clean({ verses: [verse('EXO.13.2')] }));
  assert.doesNotThrow(() => clean({ body: 'a thought' }));
});

test('a draft must say where it came from', () => {
  assert.throws(() => cleanNoteDraft({ body: 'x' }), /where it came from/);
  assert.throws(() => cleanNoteDraft({ body: 'x', source: 'elsewhere' }), /where it came from/);
  assert.equal(clean({ body: 'x' }).fields.source, 'page');
});

test('anything that is not an object is rejected', () => {
  for (const v of [null, undefined, 'x', 7, []]) assert.throws(() => cleanNoteDraft(v), /must be an object/);
});

test('fields the worker owns cannot be set from a draft', () => {
  const { fields } = clean({ body: 'x', id: 'n_evil', createdAt: 1, updatedAt: 1, deletedAt: 1, verseKeys: ['GEN.1.1'], junk: true });
  assert.deepEqual(Object.keys(fields).sort(), ['body', 'source']);
});

test('tags come back as sorted names, with the labels alongside', () => {
  const { fields, tagEntries } = clean({ body: 'x', tags: ['Zion', 'faith', 'FAITH'] });
  assert.deepEqual(fields.tags, ['faith', 'zion']);
  assert.deepEqual(tagEntries, [{ name: 'faith', label: 'faith' }, { name: 'zion', label: 'Zion' }]);
});

test('verseKeys match verses', () => {
  const { fields } = clean({ verses: [verse('EXO.13.2'), verse('EXO.13.3')] });
  assert.deepEqual(fields.verseKeys, ['EXO.13.2', 'EXO.13.3']);
});

test('verseKeys holds a verse once, however often it appears', () => {
  assert.deepEqual(deriveVerseKeys([{ usfm: 'EXO.13.2' }, { usfm: 'EXO.13.2' }]), ['EXO.13.2']);
});

// data-usfm can read "JHN.1.1+JHN.1.2"; the rule is the part before the plus (02-verse-dom.md).
test('a combined verse is stored under its first reference', () => {
  const { fields } = clean({ verses: [verse('JHN.1.1+JHN.1.2')] });
  assert.equal(fields.verses[0].usfm, 'JHN.1.1');
  assert.deepEqual(fields.verseKeys, ['JHN.1.1']);
});

test('book, chapter and verse are worked out from usfm, never read from the draft', () => {
  const [v] = clean({ verses: [verse('1CO.13.4', { book: 'GEN', chapter: 99, verse: 'x' })] }).fields.verses;
  assert.equal(v.book, '1CO');
  assert.equal(v.chapter, 13);
  assert.equal(v.verse, 4);
});

test('a verse keeps only the known fields, on both sides', () => {
  const [v] = clean({
    verses: [verse('EXO.13.2', {
      junk: 1,
      displayRef: 'யாத்திராகமம் 13:2',
      primary: { versionId: '339', abbr: 'TAOVBSI', lang: 'tam', text: 'a', html: '<b>x</b>' },
      parallel: { versionId: '114', abbr: 'NKJV', lang: 'eng', text: 'b', html: '<b>y</b>' },
    })],
  }).fields.verses;
  assert.deepEqual(Object.keys(v).sort(), ['book', 'chapter', 'displayRef', 'parallel', 'primary', 'usfm', 'verse']);
  assert.deepEqual(v.primary, { versionId: '339', abbr: 'TAOVBSI', lang: 'tam', text: 'a' });
  assert.deepEqual(v.parallel, { versionId: '114', abbr: 'NKJV', lang: 'eng', text: 'b' });
  assert.equal(v.displayRef, 'யாத்திராகமம் 13:2');
});

// T-011 R4: what resolveVersion returns for a version nothing could name, source field included.
// An unknown language comes back as null, and that must not be what stops the save.
test('a verse from a version nothing could name is still accepted', () => {
  const [v] = clean({
    verses: [verse('EXO.13.2', {
      primary: { versionId: '999999', abbr: '999999', lang: null, source: 'id', text: 'வசனம்' },
    })],
  }).fields.verses;
  assert.deepEqual(v.primary, { versionId: '999999', abbr: '999999', lang: '', text: 'வசனம்' });
});

test('a missing parallel is null, and a missing display reference is empty', () => {
  const [v] = clean({ verses: [verse('EXO.13.2')] }).fields.verses;
  assert.equal(v.parallel, null);
  assert.equal(v.displayRef, '');
});

test('a malformed verse refuses the whole draft', () => {
  assert.throws(() => clean({ verses: [verse('JHN.INTRO1')] }), /not a verse reference/);
  assert.throws(() => clean({ verses: [verse('EXO.13')] }), /not a verse reference/);
  assert.throws(() => clean({ verses: [{ primary: {} }] }), /must be text/);
  assert.throws(() => clean({ verses: [{ usfm: 'EXO.13.2' }] }), /no primary text/);
  assert.throws(() => clean({ verses: [verse('EXO.13.2', { primary: { text: 7 } })] }), /must be text/);
  assert.throws(() => clean({ verses: 'EXO.13.2' }), /must be a list/);
  assert.throws(() => clean({ verses: [null] }), /missing its reference/);
});

test('wrong-typed fields are refused', () => {
  assert.throws(() => clean({ body: 7 }), /must be text/);
  assert.throws(() => clean({ body: 'x', title: 7 }), /must be text/);
  assert.throws(() => clean({ body: 'x', pinned: 'yes' }), /true or false/);
  assert.throws(() => clean({ body: 'x', color: 7 }), /must be text/);
});

test('color may be null', () => {
  assert.equal(clean({ body: 'x', color: null }).fields.color, null);
});

// repo.js decides this against the database, inside its transaction.
test('topicId passes through unchecked for the repository to settle', () => {
  assert.equal(clean({ body: 'x', topicId: 't_1' }).fields.topicId, 't_1');
  assert.equal('topicId' in clean({ body: 'x' }).fields, false);
});

// ---------- Note patches (R4) ----------
test('a patch has only what was sent, so a merge cannot wipe the rest', () => {
  assert.deepEqual(cleanNotePatch({ body: 'new' }).fields, { body: 'new' });
  assert.deepEqual(cleanNotePatch({}).fields, {});
});

test('a patch can set Uncategorized, which is not the same as saying nothing', () => {
  assert.deepEqual(cleanNotePatch({ topicId: null }).fields, { topicId: null });
});

test('changed verses bring re-derived keys, by the same function as create', () => {
  const { fields } = cleanNotePatch({ verses: [verse('GEN.1.1'), verse('GEN.1.2')] });
  assert.deepEqual(fields.verseKeys, ['GEN.1.1', 'GEN.1.2']);
  assert.deepEqual(fields.verses[0].usfm, clean({ verses: [verse('GEN.1.1')] }).fields.verses[0].usfm);
});

test('a patch leaves verseKeys alone when verses were not sent, and cannot supply its own', () => {
  assert.equal('verseKeys' in cleanNotePatch({ body: 'x' }).fields, false);
  assert.equal('verseKeys' in cleanNotePatch({ verseKeys: ['GEN.1.1'] }).fields, false);
});

test('a whole note sent back as a patch cannot change what the worker owns', () => {
  const { fields } = cleanNotePatch({ id: 'n_x', createdAt: 1, updatedAt: 1, deletedAt: 1, source: 'menu', body: 'x' });
  assert.deepEqual(fields, { body: 'x' });
});

// Autosave after a clear-and-retype passes through this state (T-022 R2).
test('a patch may empty a note, which is why only a draft is checked', () => {
  assert.deepEqual(cleanNotePatch({ body: '' }).fields, { body: '' });
});

test('a patch is checked like a draft', () => {
  assert.throws(() => cleanNotePatch(null), /must be an object/);
  assert.throws(() => cleanNotePatch({ tags: 'x' }), /must be a list/);
});

// ---------- Filters, sort, page (R6) ----------
test('no filter is the live list', () => {
  assert.deepEqual(cleanNoteFilter(undefined), { trashed: false });
  assert.deepEqual(cleanNoteFilter(null), { trashed: false });
});

test('only a literal true means Trash', () => {
  assert.equal(cleanNoteFilter({ trashed: true }).trashed, true);
  assert.equal(cleanNoteFilter({ trashed: 'true' }).trashed, false);
});

test('unknown filter fields are ignored', () => {
  assert.deepEqual(cleanNoteFilter({ junk: 1 }), { trashed: false });
});

test('a tag filter is normalized, so a label or a decomposed form finds it', () => {
  assert.equal(cleanNoteFilter({ tag: 'Faith' }).tag, 'faith');
  assert.equal(cleanNoteFilter({ tag: TAMIL_DECOMPOSED }).tag, TAMIL_COMPOSED);
  assert.throws(() => cleanNoteFilter({ tag: '  ' }), /needs a tag/);
});

test('topicId null survives as Uncategorized and absent stays absent', () => {
  assert.equal(cleanNoteFilter({ topicId: null }).topicId, null);
  assert.equal('topicId' in cleanNoteFilter({}), false);
});

test('a chapter or verse must look like one', () => {
  assert.equal(cleanNoteFilter({ chapter: 'EXO.13' }).chapter, 'EXO.13');
  assert.equal(cleanNoteFilter({ chapter: '1CO.13' }).chapter, '1CO.13');
  assert.throws(() => cleanNoteFilter({ chapter: 'EXO' }), /not a chapter/);
  assert.throws(() => cleanNoteFilter({ chapter: 'EXO.13.2' }), /not a chapter/);
  assert.equal(cleanNoteFilter({ verseKey: 'EXO.13.2' }).verseKey, 'EXO.13.2');
  assert.throws(() => cleanNoteFilter({ verseKey: 'EXO.13' }), /not a verse/);
});

test('a date range must be numbers, in order', () => {
  assert.deepEqual(cleanNoteFilter({ from: 1, to: 2 }), { trashed: false, from: 1, to: 2 });
  assert.throws(() => cleanNoteFilter({ from: 'today' }), /timestamp/);
  assert.throws(() => cleanNoteFilter({ from: 5, to: 1 }), /ends before/);
});

test('sorting defaults to newest changed, and most recently deleted in Trash', () => {
  assert.deepEqual(cleanNoteSort(undefined, { trashed: false }), { by: 'updatedAt', dir: 'desc' });
  assert.deepEqual(cleanNoteSort(undefined, { trashed: true }), { by: 'deletedAt', dir: 'desc' });
});

test('a sort that means nothing is refused', () => {
  assert.throws(() => cleanNoteSort({ by: 'title' }, { trashed: false }), /cannot be sorted/);
  assert.throws(() => cleanNoteSort({ dir: 'sideways' }, { trashed: false }), /direction/);
  assert.throws(() => cleanNoteSort({ by: 'deletedAt' }, { trashed: false }), /Only Trash/);
});

test('a page has sane defaults and a ceiling', () => {
  assert.deepEqual(cleanPage(undefined), { offset: 0, limit: DEFAULT_PAGE_SIZE });
  assert.deepEqual(cleanPage({ offset: 20, limit: 10 }), { offset: 20, limit: 10 });
  assert.equal(cleanPage({ limit: 1e9 }).limit, MAX_PAGE_SIZE);
  assert.deepEqual(cleanPage({ offset: -1, limit: 'x' }), { offset: 0, limit: DEFAULT_PAGE_SIZE });
});

test('limit 0 is allowed, for asking only for the total', () => {
  assert.equal(cleanPage({ limit: 0 }).limit, 0);
});

// ---------- Topics ----------
test('a slug keeps Tamil letters and their vowel signs', () => {
  assert.equal(slugify('Exodus: Study!'), 'exodus-study');
  assert.equal(slugify(TAMIL_DECOMPOSED), TAMIL_COMPOSED);
  assert.equal(slugify('விசுவாசம் பற்றி'), 'விசுவாசம்-பற்றி');
});

test('a topic needs a name, stored in NFC with its slug', () => {
  assert.throws(() => cleanTopicDraft({ name: '   ' }), /needs a name/);
  assert.throws(() => cleanTopicDraft({}), /must be text/);
  assert.deepEqual(cleanTopicDraft({ name: ' Exodus Study ' }), { name: 'Exodus Study', slug: 'exodus-study' });
  assert.equal(cleanTopicDraft({ name: TAMIL_DECOMPOSED }).name, TAMIL_COMPOSED);
});

test('a topic patch keeps the slug in step with the name and sends only what changed', () => {
  assert.deepEqual(cleanTopicPatch({ name: 'New Name' }), { name: 'New Name', slug: 'new-name' });
  assert.deepEqual(cleanTopicPatch({ color: null }), { color: null });
  assert.deepEqual(cleanTopicPatch({ order: 3 }), { order: 3 });
  assert.deepEqual(cleanTopicPatch({ id: 'x', deletedAt: 1 }), {});
  assert.throws(() => cleanTopicPatch({ order: 'first' }), /must be a number/);
});
