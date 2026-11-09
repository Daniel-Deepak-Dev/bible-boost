/*
 * BibleBoost — IndexedDB connection
 * The one place that opens the database, and the one place IndexedDB's event API is turned into
 * promises (T-003 R1), so no onsuccess handler ever needs to be written anywhere else. The service
 * worker is the only client of this database (architecture rule 1), and migrate.js decides what the
 * versions look like.
 *
 * It opens lazily, from inside a handler, and never at load. A module service worker may not use
 * top-level await, so `await openDb()` at the top of background.js would stop the worker from
 * registering at all (05-mv3-constraints.md).
 */
import { SCHEMA_VERSION } from '../shared/schema.js';
import { NEWER_DB_ERROR, runLadder, checkStoredVersion } from './migrate.js';

const DB_NAME = 'bibleboost';

const BLOCKED_ERROR = 'The notes database is busy upgrading in another window. Close other BibleBoost pages and try again.';

// ---------- Promises over events ----------
// The only two wrappers the data layer needs. Between two requests of one transaction, await only
// these: a transaction commits itself as soon as it has nothing pending, so awaiting anything else
// (a chrome.storage call, say) leaves the next request failing with TransactionInactiveError.
export const reqDone = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

// Resolves when the transaction has actually COMMITTED, which is later than its last request
// succeeding, so this is what "after the transaction commits" in T-005 R7 has to wait for.
export const txDone = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error);
});

// Calls visit with each row a cursor request yields, in order, and resolves when the rows run out or
// visit returns false. This is the third wrapper, for the one request that fires onsuccess more than
// once, so repo.js need not write an onsuccess of its own (T-003 R1).
//
// The try is not defensive filler. An exception inside onsuccess would abort the transaction and
// leave this promise pending forever, which is a silent hang for whoever asked (T-002 R4).
export const walkCursor = (req, visit) => new Promise((resolve, reject) => {
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const cursor = req.result;
    try {
      if (!cursor || visit(cursor.value) === false) { resolve(); return; }
      cursor.continue();
    } catch (err) {
      reject(err);
    }
  };
});

// ---------- Connection ----------
// Shared by every handler in this run of the worker. It is the promise rather than the database so
// that two messages arriving while it is still opening share one open. It can be rebuilt at any
// time, which is what T-002 R8 asks of module state: when Chrome stops the worker this goes with it,
// and the next call simply opens again.
let connection = null;

// A failed open is deliberately not kept, or one bad moment would make every later call fail the
// same way until the worker happened to restart.
export function openDb() {
  connection ??= connect().catch((err) => { connection = null; throw err; });
  return connection;
}

function connect() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    let ladderError = null;
    let gaveUp = false;

    // An exception here would also abort the upgrade, but the open would then report a bare
    // AbortError. Keeping the original says which step failed and why.
    req.onupgradeneeded = (e) => {
      try {
        runLadder(req.result, req.transaction, e.oldVersion);
      } catch (err) {
        ladderError = err;
        req.transaction.abort();
      }
    };

    // Another connection is holding the old version open and has not closed. The request stays
    // pending until it does, possibly forever, and a pending open is a silent hang for whoever
    // asked (T-003 R7). So answer now and let the upgrade finish whenever it can; see onsuccess.
    req.onblocked = () => {
      gaveUp = true;
      console.error('[BibleBoost] database upgrade is blocked by another open connection');
      reject(new Error(BLOCKED_ERROR));
    };

    // VersionError is how IndexedDB says the database on disk is newer than the version asked for.
    req.onerror = () => {
      reject(ladderError ?? (req.error?.name === 'VersionError' ? new Error(NEWER_DB_ERROR) : req.error));
    };

    req.onsuccess = () => {
      const db = req.result;
      // The caller was already told this failed, so nobody will ever use or close this connection.
      // Left open it would block the next upgrade in turn. The upgrade itself has finished by now.
      if (gaveUp) { db.close(); return; }
      // Closing on versionchange is what stops this connection ever being the one that blocks a
      // future upgrade. onclose covers the browser dropping it, such as when site data is cleared.
      // Either way the next openDb() must open afresh instead of returning a dead handle.
      db.onversionchange = () => { db.close(); connection = null; };
      db.onclose = () => { connection = null; };
      resolve(verified(db));
    };
  });
}

async function verified(db) {
  try {
    const row = await reqDone(db.transaction('meta').objectStore('meta').get('schemaVersion'));
    checkStoredVersion(row?.value);
    return db;
  } catch (err) {
    db.close();
    throw err;
  }
}
