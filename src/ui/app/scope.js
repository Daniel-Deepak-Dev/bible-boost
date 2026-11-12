/*
 * BibleBoost — the panel's scope
 * Which notes the side panel lists: the chapter on screen, its book, or all of them (T-023). The panel is
 * open while somebody reads a particular chapter, and three notes on it matter more than three hundred
 * on everything, so the chapter is where it starts. The notes page (EPIC-03) lists everything and has
 * EPIC-05's filters instead, and does not use this.
 *
 * The rules are plain functions over plain data, so that node --test can hold them (test/scope.test.js).
 * The control is the one piece of DOM, and touches it only inside its function, so this file still
 * loads in Node.
 *
 * Built with createElement and textContent (AGENTS.md rule 2): a label comes from bible.com's page.
 */

// ---------- The rules ----------
export const SCOPES = Object.freeze(['chapter', 'book', 'all']);
export const DEFAULT_SCOPE = 'chapter';

// The shape BB.dom's REF_RE gives a chapter and schema.js's CHAPTER_RE accepts, and nothing more: a ref
// arrives from panel-host.js by postMessage, where bible.com's own scripts can post too (03-messaging.md),
// so it is checked before it becomes a filter. Anything else is null, which is the book intro's answer.
const REF_RE = /^[A-Z0-9]{3}\.\d+$/;

export const cleanRef = (raw) => (typeof raw === 'string' && REF_RE.test(raw) ? raw : null);
export const cleanScope = (raw) => (SCOPES.includes(raw) ? raw : DEFAULT_SCOPE);

// A label is display text from the page, and the host already caps it. Capped again here because a page
// script can post its own.
const LABEL_MAX = 80;
export const cleanLabel = (raw) => (typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, LABEL_MAX) : null);

export const bookOf = (ref) => (ref ? ref.split('.')[0] : null);

// R9. A page with no chapter, a book intro, cannot have a chapter or a book scope, and an empty list there
// would look broken, so it shows All. The user's own choice is left as it was: the next chapter they open
// goes back to it.
export const effectiveScope = (scope, ref) => (ref ? scope : 'all');

// The worker's filter for a scope (repo.js, planNoteQuery): a prefix range on byVerse for the chapter
// and the book (R8), and nothing at all for All.
export function filterFor(scope, ref) {
  const shown = effectiveScope(scope, ref);
  if (shown === 'chapter') return { chapter: ref };
  if (shown === 'book') return { book: bookOf(ref) };
  return {};
}

// Two filters are the same list exactly when they are the same object, and these are small and flat.
export const sameFilter = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Whether a note is in the list a filter gives, by the same test noteMatches applies in the worker. For
// a note written in the panel, which has no verse and so is never in a chapter or a book (T-022 R4).
export function inFilter(note, filter) {
  const keys = Array.isArray(note?.verseKeys) ? note.verseKeys : [];
  if (filter.chapter) return keys.some((k) => k.startsWith(`${filter.chapter}.`));
  if (filter.book) return keys.some((k) => k.startsWith(`${filter.book}.`));
  return true;
}

// How the chapter and its book are called in words. The label is the reader's own heading, which the host
// sends only when it ends in this chapter's number, so taking that number off leaves the book's name,
// "யாத்திராகமம்", in whatever script the version writes it. Without a label, the USFM, "EXO 13".
export function chapterName(ref, label) {
  if (!ref) return '';
  return label || ref.replace('.', ' ');
}

export function bookName(ref, label) {
  if (!ref) return '';
  const name = label ? label.replace(/[\s.:,-]*\d+$/, '').trim() : '';
  return name || bookOf(ref);
}

// R3. What an empty list says, so that an empty chapter reads as "nothing here yet" and never as
// "something is broken": the scope it looked in, and how many notes there are elsewhere. counts is
// { chapter, book, all }, any of them null until the worker has answered. null back means the list's own
// words, which are right for All.
//
// No hint about saving when there are notes elsewhere: the user has plainly found out how.
export const SAVE_HINT = 'Select a verse and choose Save to BibleBoost.';

const plural = (n) => `${n} ${n === 1 ? 'note' : 'notes'}`;

export function emptyText(scope, ref, label, counts = {}) {
  const shown = effectiveScope(scope, ref);
  if (shown === 'all') return null;
  const { book = null, all = null } = counts;
  if (shown === 'chapter') {
    const head = `No notes on ${chapterName(ref, label)} yet.`;
    if (book > 0) return `${head} ${bookName(ref, label)} has ${plural(book)}.`;
    if (all > 0) return `${head} ${plural(all)} in other books.`;
    return all === 0 ? `${head} ${SAVE_HINT}` : head;
  }
  const head = `No notes in ${bookName(ref, label)} yet.`;
  if (all > 0) return `${head} ${plural(all)} in other books.`;
  return all === 0 ? `${head} ${SAVE_HINT}` : head;
}

// The count on a segment. Compact past a thousand, "1.2K", so that the three still fit beside the
// header's buttons at the panel's 280px; the exact number is in the segment's name and tooltip.
const COMPACT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const shortCount = (n) => (Number.isInteger(n) && n >= 0 ? COMPACT.format(n) : '');

// ---------- The control ----------
// R2: one control, not three filters. The three segments are radios in one group, so a screen reader
// says "This chapter, 3 notes, radio button, 1 of 3", and the arrows move between them as they do in any
// radio group. Only the checked one is a tab stop.
//
// The visible words are the ones the user picked from a mock (2026-11-12): "Chap", "Book" and "All",
// which is what fits in place of the old title at 280px. The full names are the accessible ones.
//
// el is the radiogroup in panel.html, with a button[data-bb-scope] for each scope and a .bb-count inside
// each. onChoose(scope) is a request: the control does not move its own check, set() does, once the panel
// has actually switched the list. So the control never shows a scope the list is not showing, which
// it would while the editor asks whether to save.
const NAMES = Object.freeze({ chapter: 'This chapter', book: 'This book', all: 'All' });

export function createScopeControl(el, { onChoose = () => {} } = {}) {
  const buttons = [...el.querySelectorAll('[data-bb-scope]')];
  const enabled = (b) => b.getAttribute('aria-disabled') !== 'true';

  for (const button of buttons) {
    button.addEventListener('click', () => {
      if (enabled(button)) onChoose(button.dataset.bbScope);
    });
  }

  // Arrows choose as they move, the radio pattern, and skip a segment that cannot be chosen on this page.
  el.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const live = buttons.filter(enabled);
    const at = live.indexOf(e.target.closest('[data-bb-scope]'));
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = live[(at + 1) % live.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = live[(at - 1 + live.length) % live.length];
    else if (e.key === 'Home') next = live[0];
    else if (e.key === 'End') next = live.at(-1);
    if (!next) return;
    e.preventDefault();
    next.focus();
    onChoose(next.dataset.bbScope);
  });

  // shown is the scope the list is showing, ref and label the chapter the counts are for, and counts
  // { chapter, book, all }. On a page with no chapter, Chap and Book stay in place but cannot be chosen,
  // so that the header does not change shape between a book intro and its first chapter.
  function set({ shown, ref, label, counts = {} }) {
    for (const button of buttons) {
      const scope = button.dataset.bbScope;
      const checked = scope === shown;
      const usable = scope === 'all' || !!ref;
      const n = usable ? counts[scope] : null;
      button.setAttribute('aria-checked', String(checked));
      button.setAttribute('aria-disabled', String(!usable));
      button.tabIndex = checked ? 0 : -1;
      button.querySelector('.bb-count').textContent = shortCount(n);
      const known = Number.isInteger(n);
      button.setAttribute('aria-label', `${NAMES[scope]}${known ? `, ${plural(n)}` : ''}`);
      const what = scope === 'chapter' ? `Notes on ${chapterName(ref, label)}`
        : scope === 'book' ? `Notes in ${bookName(ref, label)}` : 'All notes';
      button.title = usable ? `${what}${known ? ` (${n})` : ''}` : 'This page is not a chapter';
    }
  }

  return { set };
}
