/*
 * BibleBoost — moving notes to Trash, and back
 * The one way the notes app trashes notes (T-022 R5, R7). A single note goes at once with an undo toast
 * and no question. Several ask first, with the count, because that is what tells a slip from a choice;
 * then the same toast offers Undo for all of them. The panel has no way to select several notes yet, so
 * for now that path is reached from the panel's Console (bbPanel.trash), and T-027 hands it a selection.
 *
 * Trash is a soft delete (02-storage-model.md), so expiry of the toast is not a second confirmation: the
 * notes simply stay in Trash, where T-034 lets them be restored. Undo sends the worker's undoToken back as
 * notes/restore, which puts back exactly the notes that call moved, with their topic and tags, and leaves
 * alone any that were in Trash already (03-messaging.md).
 */
import { ask } from './store.js';
import { confirmDialog } from './dialog.js';

export const trashedMessage = (n) => (n === 1 ? 'Note moved to Trash' : `${n} notes moved to Trash`);

// notes/restore names any note whose topic was deleted while it sat in Trash. Those come back to
// Uncategorized, which would look like a lost topic if nothing said so.
export function restoredMessage(n, uncategorized) {
  const head = n === 1 ? 'Note restored' : `${n} notes restored`;
  if (!uncategorized) return head;
  if (n === 1) return `${head} to Uncategorized. Its topic had been deleted.`;
  return `${head}. ${uncategorized} went to Uncategorized, as their topic had been deleted.`;
}

// The toast's Undo, for a trash done here or one that was done elsewhere and noticed here. list is
// told which note to give focus to once it is back, because the Undo button that held focus has gone.
export function offerUndo(ids, message, { toasts, list }) {
  return toasts.show({
    message,
    action: {
      label: 'Undo',
      async run(toast) {
        const reply = await ask({ type: 'notes/restore', ids });
        if (!reply.ok) return toast.update(`Could not undo. ${reply.error}`);
        const restored = reply.restored ?? ids;
        toast.update(restoredMessage(restored.length, reply.uncategorized?.length ?? 0));
        if (restored.length) list?.focusWhenPlaced?.(restored[0]);
      },
    },
  });
}

// Resolves to true when the notes went to Trash. A failure is said in a toast and never dropped (R5),
// and a refusal at the question changes nothing.
//
// A note already in Trash, put there by another tab a moment ago, is skipped by the worker and left out
// of undoToken. If that was all of them there is nothing to undo, so nothing is offered.
export async function moveToTrash(ids, { toasts, list }) {
  const wanted = [...new Set(ids)];
  if (!wanted.length) return false;
  if (wanted.length > 1) {
    const yes = await confirmDialog({
      title: `Move ${wanted.length} notes to Trash?`,
      message: 'Undo brings them back straight afterwards.',
      confirmLabel: 'Move to Trash',
      danger: true,
    });
    if (!yes) return false;
  }
  const reply = await ask({ type: 'notes/trash', ids: wanted });
  if (!reply.ok) {
    toasts.show({ message: `Could not move to Trash. ${reply.error}` });
    return false;
  }
  const moved = reply.undoToken ?? [];
  if (moved.length) offerUndo(moved, trashedMessage(moved.length), { toasts, list });
  return true;
}
