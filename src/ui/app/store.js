/*
 * BibleBoost — the notes app's line to the worker
 * Shared by the panel and, from EPIC-03, the notes page (01-architecture.md, rule 3). Everything the
 * app knows about notes it asks the service worker for here, and everything it hears about changes made
 * elsewhere arrives here as the notesRev signal. Nothing in this file touches the DOM.
 *
 * Talking to the worker directly, and never through panel-host.js, is what keeps note text off the
 * postMessage channel, where bible.com's own scripts can read it (03-messaging.md).
 *
 * chrome.* is only reached inside the functions, so the file still loads in plain Node for the tests
 * of list.js, which imports it.
 */

// ---------- Asking the worker ----------
// Every failure comes back as { ok: false, error }, the router's own shape, so a caller has one thing
// to check. Two failures the router cannot report itself, both from Chrome's documentation and not
// provoked here (03-messaging.md): no reply at all, when the worker dies part way, and a throw, when
// the extension has been reloaded and this frame is left talking to nothing. The panel then says what
// it could not do rather than sitting empty.
export async function ask(msg) {
  try {
    const reply = await chrome.runtime.sendMessage(msg);
    return reply ?? { ok: false, error: 'The extension did not answer.' };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

// ---------- Topics and tags ----------
// What a row needs to draw a note's topic dot and tag chips: a topic's name and colour by id, and a
// tag's label by its normalized name, since a note stores only the name (02-storage-model.md). Both
// lists are small, so they are fetched whole and kept, and refetched when a 'topics' or 'tags' change
// arrives.
//
// A failed fetch leaves the old maps in place, so a row falls back to a plain dot and the bare name
// rather than to nothing.
export async function loadLookups(previous = { topics: new Map(), tags: new Map() }) {
  const [topics, tags] = await Promise.all([ask({ type: 'topics/list' }), ask({ type: 'tags/list' })]);
  return {
    topics: topics.ok ? new Map(topics.topics.map((t) => [t.id, t])) : previous.topics,
    tags: tags.ok ? new Map(tags.tags.map((t) => [t.name, t])) : previous.tags,
  };
}

// ---------- Hearing about changes ----------
// The worker bumps notesRev in chrome.storage.local after every write, with the note ids it touched
// and what kind of write it was (03-messaging.md). Every surface listens for that rather than being
// sent anything, which needs no tabs permission and costs a surface with nothing open nothing.
//
// changes.notesRev is what is watched: it rises by exactly one per write, where the other two keys
// can stay the same. Two updates of the same note in a row store the same notesRevIds and the same
// notesRevKind, and storage.onChanged reports only keys whose value changed, so the second event can
// arrive carrying notesRev alone (Chrome's documented behaviour for onChanged, not provoked here). The
// last values seen stand in for whichever key is missing, which is why they are read once at the start.
//
// listener gets { rev, kind, ids }. The returned function stops it.
export function onNotesChange(listener) {
  const last = { kind: null, ids: [] };
  try {
    chrome.storage.local.get(['notesRevKind', 'notesRevIds'], (got) => {
      if (chrome.runtime.lastError) return;
      last.kind ??= got.notesRevKind ?? null;
      if (!last.ids.length && Array.isArray(got.notesRevIds)) last.ids = got.notesRevIds;
    });
  } catch (err) {
    console.debug('[BibleBoost] panel: could not read the last change', err);
  }

  const handler = (changes, area) => {
    if (area !== 'local') return;
    if ('notesRevKind' in changes) last.kind = changes.notesRevKind.newValue ?? null;
    if ('notesRevIds' in changes) last.ids = Array.isArray(changes.notesRevIds.newValue) ? changes.notesRevIds.newValue : [];
    if (!changes.notesRev) return;
    listener({ rev: changes.notesRev.newValue, kind: last.kind, ids: last.ids });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
