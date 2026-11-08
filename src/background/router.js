/*
 * BibleBoost — message router
 * Turns one chrome.runtime message into one reply. background.js owns the listener and the handler
 * table; this file owns the rules every reply follows, so that each later handler (T-005 onwards)
 * gets them for free instead of re-implementing them, slightly differently, in each one.
 *
 * It is a separate module, with no chrome.* in it, for one reason: the "a handler that throws still
 * gets a reply" promise can only be proven here. Inside the live worker that needs a handler that
 * throws, which nobody wants to ship, and a service worker cannot import() a module from its own
 * console to try one. `node --test test/router.test.js` can.
 */

// ---------- Dispatch ----------
// The contract, which test/router.test.js holds it to:
//
// - It ALWAYS resolves and never rejects. background.js does dispatch(...).then(reply), so a
//   rejection here would mean reply is never called. An unanswered chrome.runtime.sendMessage is a
//   silent hang in the UI with no console trace on the caller's side (T-002 R4).
// - A known msg.type calls handlers[msg.type](msg), so a handler reads its own payload off the
//   message ({ type: 'notes/get', id }), and resolves to whatever that handler resolves to: a plain
//   object, by convention { ok: true, ... }.
// - An unknown type, a missing type or a missing msg resolves to
//   { ok: false, error: 'unknown message type' } (R5).
// - Only the table's OWN keys count. handlers['toString'] finds Object.prototype.toString through
//   the prototype chain, and calling it would "succeed" with the string "[object Undefined]".
//   'constructor' and '__proto__' do the same kind of thing.
// - A throw, sync or async, of an Error or of anything else, resolves to { ok: false, error } with
//   error a STRING. sendResponse serializes the reply as JSON, and an Error object comes out of
//   that as {}, which tells the caller nothing. The full error, stack included, goes to
//   console.error, where it shows in the worker's own DevTools (chrome://extensions, "service
//   worker" link).
export async function dispatch(handlers, msg) {
  // TODO(human)
}
