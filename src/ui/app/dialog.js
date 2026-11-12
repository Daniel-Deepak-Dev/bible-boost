/*
 * BibleBoost — the question dialog
 * For the few actions that warrant a question first (T-022 R7). Most do not: deleting one note is an
 * undo toast and no dialog at all, because a question on every delete punishes the common case and is
 * answered by reflex in the rare one. What does ask is deleting several notes at once, where the count
 * is the news, and leaving a note with changes that have not been saved, which nothing can bring back.
 *
 * Type-to-confirm, R7's treatment for Delete forever, is not here. That action belongs to the Trash view,
 * T-034, and arrives with it: a mode nothing calls yet would be one nobody has checked.
 *
 * A real <dialog> opened with showModal, so the rest of the page is inert while it is up, Escape is the
 * browser's own cancel, and focus comes back on its own when it closes. Built with createElement and
 * textContent (AGENTS.md rule 2).
 */

let dialogCount = 0;

function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// Asks one question and resolves to the value of the button pressed. choices are { value, label, kind },
// in the order they are drawn, kind being 'primary' (the accent fill), 'danger' (red, for what cannot be
// undone; theme.css: accent and danger differ by hue alone, so the word carries it) or nothing. cancel is
// the value Escape gives, and any other way the dialog might close; it should be the choice that changes
// nothing. focus is the value whose button has focus as it opens, the cancel one unless said otherwise, so
// that an Enter pressed by reflex keeps what is there. It always resolves.
export function chooseDialog({ title, message = '', choices, cancel, focus = cancel, host = document.body }) {
  return new Promise((resolve) => {
    dialogCount += 1;
    const titleId = `bb-dialog-title-${dialogCount}`;
    const dialog = make('dialog', 'bb-dialog');
    dialog.setAttribute('aria-labelledby', titleId);
    const heading = make('h2', 'bb-dialog-title', title);
    heading.id = titleId;
    dialog.append(heading);
    if (message) {
      const text = make('p', 'bb-dialog-text', message);
      const textId = `bb-dialog-text-${dialogCount}`;
      text.id = textId;
      dialog.setAttribute('aria-describedby', textId);
      dialog.append(text);
    }

    // The answer is given by the buttons and by Escape directly, and not by waiting for the dialog's
    // close event. In the built-in browser with its pane hidden, close() shut the dialog and the close
    // event never came (T-022), so the answer never came either, and the panel's queue of actions,
    // which waits on it, stopped for good. The close event stays as the way in for any other close.
    //
    // Chrome gives focus back by itself as a modal closes. This is for a browser that does not, and
    // for an element the dialog's answer has since taken out of the page.
    const before = document.activeElement;
    let answered = false;
    function answer(value) {
      if (answered) return;
      answered = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      if (before?.isConnected && document.activeElement !== before) before.focus({ preventScroll: true });
      resolve(value);
    }

    const actions = make('div', 'bb-dialog-actions');
    let first = null;
    for (const { value, label, kind } of choices) {
      const btn = make('button', 'bb-btn', label);
      btn.type = 'button';
      if (kind === 'primary') btn.setAttribute('data-bb-primary', '');
      if (kind === 'danger') btn.setAttribute('data-bb-danger', '');
      btn.addEventListener('click', () => answer(value));
      actions.append(btn);
      if (value === focus) first = btn;
    }
    dialog.append(actions);
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      answer(cancel);
    });
    dialog.addEventListener('close', () => answer(cancel), { once: true });

    host.append(dialog);
    dialog.showModal();
    (first ?? actions.firstChild)?.focus();
  });
}

// A yes-or-no question: true only for the confirm button. Escape, Cancel, and a dialog closed any other
// way are all false, because "not a clear yes" must never be read as a yes.
//
// danger marks the confirm button as the destructive one and starts focus on Cancel. Otherwise focus
// starts on the confirm button, which is then the primary one.
export function confirmDialog({ title, message = '', confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false, host = document.body }) {
  return chooseDialog({
    title,
    message,
    host,
    choices: [
      { value: false, label: cancelLabel },
      { value: true, label: confirmLabel, kind: danger ? 'danger' : 'primary' },
    ],
    cancel: false,
    focus: danger ? false : true,
  });
}
