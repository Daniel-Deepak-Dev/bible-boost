# T-059 — Import notes from the YouVersion Bible App

| Field | Value |
|---|---|
| Epic | EPIC-06 Import and export |
| Status | Not started |
| Depends on | T-046, T-048 |
| Blocks | — |
| Size | M |
| Risk | **High.** It relies on YouVersion's undocumented internal API, which can change or close without notice |

## Why

The user has years of notes in the YouVersion Bible App on their phone. Those
notes are about the same verses BibleBoost captures, and today the only way to
move one across is to copy it out by hand.

YouVersion offers no export. Its official API will not give out notes. bible.com
has no notes page, signed in or out. What does work is the internal API the
YouVersion apps use, `moments.youversionapi.com`, called from a signed-in
bible.com page with the session that page already has. **The user chose this
route on 2026-11-12, knowing it is undocumented**, and it was measured working
the same day.
[`bible-com/08-youversion-account-data.md`](../../understandings/bible-com/08-youversion-account-data.md)
has every route, the measured requests and the shape of a note. **Read it
first.**

## Scope

**In:** reading the signed-in user's own notes from the moments API in a content
script on a bible.com tab, and bringing them in through the T-046 / T-048
pipeline.

**Out:**

- highlights, bookmarks and reading plans, though `items.json` lists them too.
  BibleBoost has no model for them yet
- writing anything to YouVersion: no POST, no update, no delete, ever
- the official YouVersion Platform API, which cannot read notes
- the password route, and anything else that asks for, stores or sends a
  YouVersion credential
- the Android app's headers, client id or client secret
- verse text. A YouVersion note does not carry it (R4)
- anyone else's notes

## Requirements

**R1. Only in a signed-in bible.com tab.** The requests run in a content script
on `https://www.bible.com/*`, which the manifest already matches. There they go
out as bible.com's origin, with its cookies, so **no new permission** is added.
If `GET /api/authenticate` does not answer 200 with an `accessToken`, the import
stops and says plainly that the user has to sign in to bible.com. It sends
nothing.

**R2. The token never leaves the request.** `accessToken` is read from
`/api/authenticate` once per import and held in a local variable for that
import's requests. It is never stored, never logged, never put in a message to
the worker, and never shown.

**R3. The requests, exactly.**

- `GET https://moments.youversionapi.com/3.1/items.json?kind=note&user_id=<user.id>&page=<n>`,
  with `user.id` from the same `/api/authenticate` answer.
- Headers: bible.com's web client set (`Accept: application/json`,
  `X-YouVersion-Client: youversion`, `X-YouVersion-App-Platform: web`,
  `X-YouVersion-App-Version: 3`) plus `Authorization: Bearer <accessToken>`.
  Never `android`, never a client id or secret.
- GET only. Pages are fetched **one at a time**, starting at 1 and following
  `next_page` until it is `null`. Stop at 2,000 pages, which is 50,000 notes,
  T-048's cap per import, and say so if that happens.
- A non-200 answer, or a body without `response.data.moments`, ends the import
  with the status code and the `errors[].key` values shown. Nothing from a
  failed run is applied. An undocumented API is expected to change, and the
  user needs to see that it did.

**R4. Mapping**, in a pure `src/shared/youversion.js`. One YouVersion note
becomes one draft:

| BibleBoost field | From |
|---|---|
| `verses` | every `usfm` value of every `extras.references[]` entry, one `VerseRef` each. Order comes from the worker's canonical sort (T-016) |
| `verses[].primary` | `versionId`: that reference's `version_id` as a string. `abbr`: from the table in `src/shared/versions.js` for a known id, otherwise `''`. `lang`: `''`. `text`: `''` |
| `verses[].displayRef` | the reference's `human` when the reference holds exactly one verse, otherwise `''` |
| `verses[].parallel` | `null` |
| `title` | `extras.title` if it is a non-empty string, otherwise `''`. **Never** `base.title`, which is a localisation key |
| `body` | `extras.content`, verbatim. A line starting `#` will render as a heading, and that is accepted |
| `tags` | `extras.labels`, when it is an array of strings. Anything else is ignored and reported in the preview, because no note with labels has been seen yet |
| `topicId` | `null`, so the note lands in Uncategorized |
| `createdAt`, `updatedAt` | `Date.parse` of `created_dt` and `updated_dt` |
| `source` | `'import'` |

A usfm value that fails `USFM_RE` fails that one note, which is reported. It
does not fail the import (T-048 R6).

**R5. Ids are strings, from the raw text.** The response is read with
`res.text()` and parsed with a `JSON.parse` reviver that returns `ctx.source`
for any `id` that is not a safe integer. `response.json()` corrupts every
19-digit id (measured: 6 of 6, see the trap in `08-youversion-account-data.md`),
and a corrupted id breaks R6. `test/youversion.test.js` proves it with an id
past `MAX_SAFE_INTEGER`.

**R6. Re-importing must not duplicate.** Store YouVersion's id on the note as a
string, so that a second import under **Skip existing** matches it. That is a
new field, so it needs a schema version bump and a migration through the T-003
ladder. Name it `importedFrom: { app: 'youversion', id: '<19-digit string>' }`
unless T-046's matching rules call for something else, and record the decision
in Notes.

**R7. Private notes are imported.** All 6 measured were `private`. They are the
user's own, and they are most of what a person writes.

**R8. Where the user starts it.** From the side panel, which lives on a bible.com
page, so the request runs in that tab's content script (`panel-host.js` or a
sibling). The panel shows the count found and then T-046's preview. The
full-page app cannot run it, because it is not on bible.com.

**R9. Say what it is.** Before the first request, the panel says in one sentence
that this reads the user's notes from YouVersion with their bible.com sign-in,
using a connection YouVersion does not document, which may stop working.

## Files

- `src/shared/youversion.js` — the reviver parse and the mapping. No `chrome.*`,
  no DOM
- `src/content/youversion-import.js` — the requests, in the bible.com tab
- `src/ui/panel.js` and `src/ui/app/` — the entry point and the preview
- `src/shared/schema.js`, `src/background/db.js`, `src/background/migrate.js` —
  the R6 field and its migration
- `manifest.json` — add the new content script. **No** new permission
- `test/youversion.test.js` — runs against a **made-up** response shaped like
  the measured one. Never commit the user's own notes

## Reference

- `work/understandings/bible-com/08-youversion-account-data.md` — the requests,
  the headers, a note's shape, and the id trap
- `work/understandings/extension/02-storage-model.md` — the note shape;
  `verseKeys` is derived
- `work/understandings/extension/03-messaging.md` — adding a message type
- `work/requirements/EPIC-06-import-export/T-046-json-import.md` — preview,
  diff, strategies
- `work/requirements/EPIC-06-import-export/T-048-import-validator.md` — the trust
  boundary

## Acceptance

- [ ] Signed in, the import finds every note: its count equals the number of
      notes the Bible App shows on the phone
- [ ] A note on several references in two books imports with one `VerseRef` per
      verse, in canonical order, each with its own version
- [ ] A note's body arrives word for word, and Tamil text survives intact
- [ ] Importing again under **Skip existing** adds nothing
- [ ] Two notes whose ids differ only in their last digits stay two notes
      (`test/youversion.test.js`)
- [ ] Signed out, the import says to sign in to bible.com, and the network list
      shows no request to `moments.youversionapi.com`
- [ ] The network list shows only GETs to `moments.youversionapi.com`, with
      `X-YouVersion-App-Platform: web`
- [ ] The token appears nowhere in `chrome.storage`, IndexedDB, a message to the
      worker, or the Console
- [ ] A changed or failing answer (simulated in the test with a 400 and its
      `errors[].key`) shows the status and key, and applies nothing
- [ ] A note body holding `<img src=x onerror=alert(1)>` shows as text, never as
      HTML
- [ ] The extension asks for no new permission when reloaded
- [ ] `node --test` passes

## Notes

**Decided 2026-11-12: the user chose the session route** ("Try the session
route"), after being told it relies on undocumented endpoints, can break without
warning, and likely sits outside YouVersion's terms. It was investigated the
same day, read-only, on the user's own account in the built-in browser, and it
works. 6 notes came back on one page.

This task was first written around a signed-in `bible.com/notes` page, then
around a privacy-law data request. Neither turned out to be the route: the page
does not exist, and the request is slow and uncertain. The request to
help@youversion.com remains the fallback if YouVersion ever closes this API.

Not seen yet, so a hand test must watch for them: a note with `labels`, a note
with a title, a note whose content holds newlines or HTML, and an account with
more than 25 notes (paging).

T-046 and T-048 are not started, and they come first.

No hand-test guide yet, because nothing has been built.
