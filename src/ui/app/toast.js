/*
 * BibleBoost — the toast
 * The one toast of the notes app, for the panel now and the notes page from EPIC-03 (T-022 R5, R6). It
 * says what just happened and, where that can be taken back, carries the one action that does it. T-035
 * makes it the toast for every soft delete; what it already does is what T-022 needed, plus the two
 * things from T-035 that cost a line each and would have been wrong to leave out: the timer holds while
 * the pointer or focus is on the toast (T-035 R6), and the stack is announced politely (R8).
 *
 * The save popover keeps its own copy (save-popover.js, showSaved), because it is a classic script and
 * this is an ES module it cannot import.
 *
 * Built with createElement and textContent (AGENTS.md rule 2): a message can carry a topic's name.
 */

// T-022 R5's "~5 seconds", and the popover's TOAST_MS.
const TOAST_MS = 5000;

// R6, "stacks sensibly". Three is T-035 R5's cap. A fourth takes the oldest away, which costs that
// toast's Undo and nothing else: what it offered to undo is in Trash and stays there.
const MAX_TOASTS = 3;

function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// ---------- The stack ----------
// host is where the stack goes. In the panel that is <body>, after <main>, and the stack is in the flow
// rather than floating, so that it takes its height from the list instead of covering the list's last
// row (R6). The list's ResizeObserver redraws it at the new height.
//
// The region is the live one, created once and empty, because a live region has to exist before its
// content changes for a screen reader to announce the change: a toast that brought its own role along
// would be news nobody hears. aria-atomic is false so that a second toast is read on its own, not
// together with the first one again, which role=status would otherwise imply.
//
// onFocusLost is called when a toast that held focus goes away, so that the host can put focus
// somewhere useful instead of leaving it on <body>.
export function createToasts(host, { onFocusLost = () => {} } = {}) {
  const region = make('div', 'bb-toasts');
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'false');
  host.append(region);

  const shown = [];

  // message is what happened, in words with a count where there is one ("3 notes moved to Trash",
  // T-035 R3). action, when there is one, is { label, run }, and run(toast) gets this toast's handle so
  // that it can say how it went. The action runs once: its button goes as it is pressed, so a second
  // click cannot restore something twice.
  function show({ message, action = null, ms = TOAST_MS }) {
    const box = make('div', 'bb-toast');
    const text = make('span', 'bb-toast-text', message);
    box.append(text);

    let timer = 0;
    // Checks rather than pauses, as the popover's toast does: if the pointer or the focus is on it when
    // the time is up, it starts over, so an Undo cannot be taken away from somebody reaching for it.
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (box.matches(':hover, :focus-within')) arm();
        else dismiss();
      }, ms);
    };

    function dismiss() {
      clearTimeout(timer);
      const at = shown.indexOf(handle);
      if (at < 0) return;
      shown.splice(at, 1);
      const hadFocus = box.contains(document.activeElement);
      box.remove();
      if (hadFocus) onFocusLost();
    }

    const handle = {
      dismiss,
      // A new message, and the full time again to read it.
      update(next) {
        text.textContent = next;
        arm();
      },
    };

    if (action) {
      const act = make('button', 'bb-toast-act', action.label);
      act.type = 'button';
      act.addEventListener('click', () => {
        act.remove();
        Promise.resolve(action.run(handle)).catch((err) => handle.update(`That did not work. ${err?.message ?? err}`));
      }, { once: true });
      box.append(act);
    }

    const close = make('button', 'bb-toast-x', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.title = 'Dismiss';
    close.addEventListener('click', dismiss);
    box.append(close);

    // Newest at the bottom, nearest the list, where the thing it is about just happened.
    region.append(box);
    shown.push(handle);
    while (shown.length > MAX_TOASTS) shown[0].dismiss();
    arm();
    return handle;
  }

  return {
    show,
    clear() { while (shown.length) shown[0].dismiss(); },
  };
}
