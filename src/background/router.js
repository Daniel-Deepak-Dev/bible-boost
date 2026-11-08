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
// - Only a STRING type counts. Object.hasOwn coerces its key, so { type: ['ping'] } would pass the
//   own-key test as 'ping' and run that handler for a message nobody meant to send.
// - Only the table's OWN keys count. handlers['toString'] finds Object.prototype.toString through
//   the prototype chain, and calling it would "succeed" with the string "[object Undefined]".
//   'constructor' and '__proto__' do the same kind of thing.
// - A throw, sync or async, of an Error or of anything else, resolves to { ok: false, error } with
//   error a STRING. sendResponse serializes the reply as JSON, and an Error object comes out of
//   that as {}, which tells the caller nothing. The full error, stack included, goes to
//   console.error, where it shows in the worker's own DevTools (chrome://extensions, "service
//   worker" link).
export async function dispatch(handlers, msg) {
  const type = msg?.type;
  if (typeof type !== 'string' || !Object.hasOwn(handlers, type)) {
    return { ok: false, error: 'unknown message type' };
  }
  try {
    // The await has to be inside the try. Returning the bare promise would let an async rejection
    // leave this function uncaught, which is the hang R4 exists to prevent.
    return await handlers[type](msg);
  } catch (err) {
    console.error('[BibleBoost] handler failed:', type, err);
    return { ok: false, error: errorText(err) };
  }
}

// ---------- Error text ----------
// Always a non-empty string, and it must not throw, because it runs inside dispatch's catch where
// nothing is left to catch it. String() does throw on a value with no way to become a primitive,
// such as Object.create(null), and dispatch would then reject, which is the same silent hang again.
//
// || rather than ??, because new Error('') has a message that is present but says nothing. Falling
// through gives String(err), "Error". A bare throw '' is empty both ways, hence the last fallback.
function errorText(err) {
  try {
    return String(err?.message || err) || 'handler failed';
  } catch {
    return 'handler failed';
  }
}
