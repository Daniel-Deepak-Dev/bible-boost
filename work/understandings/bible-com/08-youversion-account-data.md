# bible.com — getting a user's own YouVersion data out

Confidence: **verified** on 2026-11-12. The official API docs, the privacy
policy, bible.com both signed out and **signed in**, and YouVersion's internal
moments API through a signed-in page were all checked in the built-in browser.
Not known: what a privacy-law request returns, the shape of `labels` when a
note has some, and whether a real content script (not the page) gets the same
answers.

Read this before any work that wants the notes, highlights or bookmarks a user
made in the YouVersion Bible App, on a phone or on bible.com. It exists so that
nobody has to research these routes again. Most of them look promising and
deliver nothing. **The one that works is undocumented**, and the user chose it
knowing that.

## The question

The user writes notes in the YouVersion mobile app. Can BibleBoost bring them
in? There is no export button anywhere, so every route below is an attempt to
get around that.

## Routes, and why each one fails

| Route | Gets notes? | Status |
|---|---|---|
| A YouVersion MCP server | — | None exists |
| The official YouVersion Platform API | **No** | Highlights only, by design |
| An export inside the Bible App | No | There is none |
| bible.com's own pages, signed in | **No** | There is no notes page on the web, signed in or out |
| A privacy-law request for a copy of the data | Unknown | One email, and the result is not promised |
| YouVersion's internal "moments" API, by password | Yes | **Rejected** |
| The same internal API, through bible.com's own session | **Yes, measured** | **Chosen by the user on 2026-11-12.** Undocumented, so it can break (see the end) |

### MCP: none, and it would not help

No MCP server from YouVersion or Life.Church was found, in Anthropic's connector
registry or on the web. The Bible MCP servers that do exist (built on API.Bible,
AO Lab's Free Use Bible API, and Macaroon) serve **scripture text only**, and
none can read a user's account.

An MCP server would not fit BibleBoost even if one existed. MCP connects an AI
assistant to tools. A Chrome extension cannot use one while it runs. What
YouVersion does offer is "AI Skills" for coding agents, which help write code
against its API. Those are about building, not about anyone's data.

### The official API: highlights only, one passage at a time

YouVersion Platform (`developers.youversion.com`, base `https://api.youversion.com`)
has "Sign in with YouVersion" over OAuth 2.0 with PKCE. Its sign-in page is
explicit:

- OAuth scopes are `openid` (required), `profile` and `email`. Any other value is
  rejected with `400 invalid_scope`.
- The one data permission is `highlights`. **Notes and bookmarks are "not
  supported and must not be requested."**
- `GET /v1/highlights` needs both `bible_id` and `passage_id`. **It cannot list
  everything a user has highlighted**, and it returns a colour per verse with no
  timestamp. Reading a whole account would mean asking chapter by chapter, for
  each version they use.
- A third-party app needs an App Key (`X-YVP-App-Key`) issued by YouVersion, and
  the platform is offered for free, non-commercial use.

So the official route can never bring notes in. If BibleBoost ever has
highlights of its own, this is how they would be read, with the user's consent
through the data-exchange approval page.

### No export in the Bible App

The mobile app syncs notes, highlights and bookmarks across devices, and has no
export. App Store reviews ask for one, and report having to copy each note out
by hand.

### bible.com, signed in: no notes anywhere

This looked like the best route. A content script could read notes from a page
the user is already signed in to, the way `capture.js` reads a verse, with no
credential involved. **The page does not exist.** Measured on 2026-11-12, in the
built-in browser, signed in to a real account:

| URL | Signed out | Signed in |
|---|---|---|
| `/notes` | redirects to `/app` | **redirects to `/app`** |
| `/highlights` | redirects to `/app` | not tried |
| `/notes/61577` (indexed by a web search) | redirects to `/app` | not tried |
| `/moments` | — | redirects to `/app` |
| `/users/<username>/notes` | — | redirects to `/app` |
| `/users/<username>` | — | a page titled "Profile - Bible App", holding **only the user's name**, with no links or tabs |

`/app` is the "Download The Bible App Now" marketing page. A redirect there
means "this is a phone feature", not "sign in first".

**The account menu has no notes entry either.** Signed in, the round button at
the top right (`aria-label="Account menu"`) opens Get the App, **Account
Settings** (`/users/<username>/edit`), Sign Out and Keyboard shortcuts, as well
as the language, version and Settings controls.

**The reader shows highlights and never loads notes.** Signed in, on
`/bible/114/JHN.3.NKJV`, the page fetched:

- `https://moments.youversionapi.com/3.1/colors.json`
- `https://moments.youversionapi.com/3.1/verse_colors.json?usfm=JHN.3&version_id=114`.
  That is the chapter's highlight colours, for one version

Nothing else came from that host, and nothing at all carried a note. The verse
action menu, signed in, holds **Highlight, Copy, Compare, Share**: no Note row,
no Bookmark row. The sign-up prompt under the rows is gone. The 45 elements of
John 3 whose class has `note` in it are the translation's own cross-references
(`_note _x`, see `02-verse-dom.md`), not anything the user wrote.

**How to tell whether a page is signed in.** `GET /api/authenticate?userOnly=true`,
which bible.com calls on every load, answered **401 signed out and 200 signed
in**. A **"Sign up or sign in"** button is in the reader's DOM **in both
states**, off-screen when signed in. Its presence proves nothing.

`moments` is YouVersion's internal name for everything a user attaches to a
verse: highlights, bookmarks, notes. The rejected unofficial clients below call
the same host.

### A privacy-law request: possible, not promised

YouVersion's privacy policy (`bible.com/privacy`, section "Deleting, Accessing,
and Correcting Your Information") grants a copy of "your personal data you
provided to us". The request goes to help@youversion.com, with "[State/Country]
Privacy Request" in the subject when a regional law applies. The same section
warns that YouVersion "may be unable to provide you with content and User
Contributions that utilize YouVersion functionality". Notes may well count as
exactly that. No format is named.

This route is worth one email from the user. If the reply holds the notes as a
file, importing it is an ordinary file import through T-046/T-048, with a
YouVersion mapping. Nothing can be built until the file is seen.

### The internal moments API, by password: rejected

Unofficial clients such as `tushortz/youversion-bible-client` (Python) do export
notes and highlights. They call the app's undocumented endpoints with the user's
YouVersion **username and password**. BibleBoost will not take that route:

- The extension would have to ask for, hold and send a password for another
  service. Nothing else in BibleBoost handles a credential, and this should not
  be the first.
- The endpoints are undocumented. They can change without warning, and using them
  likely breaks YouVersion's terms.

### The internal moments API, through bible.com's session: works

**The user chose this route on 2026-11-12, knowing the risk** (recorded in
T-059). It removes the password objection above and keeps the other one: the
endpoints are undocumented, can change without notice, and likely sit outside
YouVersion's terms. Everything below was measured that day in the built-in
browser, from a signed-in bible.com reader page, on the user's own account.
Every request was a GET, and only shapes and counts were read, never note text.

#### Where bible.com's own code talks to it

The reader's bundle builds every moments URL from one base,
`https://moments.youversionapi.com/3.1/`. Only two endpoints are used on the
web: `verse_colors.json`, a GET of a chapter's highlights, and `create.json`, a
POST that saves a highlight as
`{ color, created_dt, kind: 'highlight', references: [{ usfm, version_id }] }`.
Nothing on the web lists, reads or writes a note. The bundle is hashed and moves
with every build, so find it by searching the loaded `_next/static/chunks/*.js`
for `moments.youversionapi.com`, not by file name.

#### The token: bible.com hands it to its own page

| Request (same origin, the session cookie does the rest) | Signed out | Signed in |
|---|---|---|
| `GET /api/authenticate?userOnly=true` | 401 | 200, `{ user: { id, username, firstName, lastName, email, avatarUrl, languageTag, country, timezone, verified, ... } }` |
| `GET /api/authenticate` | — | 200, the same `user`, plus `accessToken` (a 207-character string) and `expiresIn` (a number) |

`user.id` is a number of 9 digits on the account measured. Treat
`accessToken` as the user's password: hold it in a local variable for the length
of one import, and never store, log or post it anywhere.

#### The headers: bible.com's web client, exactly

bible.com's request wrapper sends these on every call to a `youversionapi.com`
host, and **without them every per-user endpoint failed**. `fetch` threw
"Failed to fetch", which is what an error answer with no CORS headers looks
like:

```
Accept: application/json
X-YouVersion-Client: youversion
X-YouVersion-App-Platform: web
X-YouVersion-App-Version: 3
Authorization: Bearer <accessToken>
```

The wrapper also sets `Referer` and `User-Agent`, which a browser does not let a
page set, so they do not matter. The public `colors.json` answered 200 without
the `X-` headers.

These are the website's own values. The unofficial Python client sends
`X-YouVersion-App-Platform: android` with an app version and a client id and
secret taken out of the Android app. **BibleBoost must never do that.** It would
be pretending to be YouVersion's app. Sending the web client's headers from the
web client's own page is what the page itself does.

CORS: called from a `https://www.bible.com` page, the moments host answered
these requests readably. MV3 content scripts make cross-origin requests as the
page's origin, so a content script should get the same answers **with no new
host permission**. That last step was not tried from a real content script.

#### Listing notes: `items.json`

| Request | Answer |
|---|---|
| `items.json?kind=note&page=1` | **400**, `errors: [{ key: 'moments._params.user_id_or_reference_required' }]` |
| `items.json?kind=note&page=1&user_id=<user.id>` | 200, `{ response: { code, buildtime, data: { moments: [...], next_page } } }` |
| `items.json?page=1&user_id=<user.id>` | 200, 25 moments of every kind, `next_page: 2` |

So `user_id` is required alongside `kind`. A page holds 25 moments.
`next_page` is the next page's number, or `null` on the last. The account
measured had 6 notes on one page.

One note, as measured (types, not values):

```
{
  id:          number, 19 digits          ← see the trap below
  kind_id:     'note.v1'
  kind_color:  string(6)
  created_dt:  'YYYY-MM-DDThh:mm:ss+hh:mm', or with microseconds, 'YYYY-MM-DDThh:mm:ss.ffffff+hh:mm'
  updated_dt:  same shape; equal to created_dt on all 6 measured
  base: {
    title: { l_str: 'moment.note.reference.self.title', l_args: { reference_human, title } },
    images: { avatar, icon }, action_url, body, share_url        ← display chrome, not the note
  },
  extras: {
    content:       string, the note's text. Plain on all 6: no tags, no newlines
    title:         null on all 6
    labels:        null on all 6, so the shape when present is unknown
    color:         null
    references:    [{ human: string, usfm: ['JHN.3.16', ...], version_id: number }, ...]
    user_status:   'private' on all 6
    system_status: 'approved'
    language_tag:  null
    user:          { id, name, username, avatar }
  },
  commenting: { enabled, total, comments }, liking: { enabled, total, likes, all_users }
}
```

- **`references` is a list, and each one carries its own `version_id`.** One
  note measured had three references, in three chapters across two books. A
  range is spelled out: one reference held eight consecutive verses as eight
  usfm values. Every usfm value matched BibleBoost's `BOOK.chapter.verse`. The
  versions seen were 114 (NKJV) and 339 (TAOVBSI). `human` is the reference as
  text, and was not read.
- **The title is not in `base.title`.** `l_str` there is a localisation key,
  `moment.note.reference.self.title`, for the line the app shows above a note.
  The user's own title, if any, is `extras.title`.
- **No verse text.** A note names its verses and versions. It never quotes them.
- `Date.parse` read every `created_dt` and `updated_dt` measured, microseconds
  included.

#### Trap: `JSON.parse` corrupts every note id

A note id is a 19-digit integer, and a JavaScript number is exact only up to
`Number.MAX_SAFE_INTEGER`, 16 digits. All 6 ids came back from
`response.json()` with **different last digits** from the raw text. They stayed
distinct by luck. Two notes can collapse into one id, and an id read this way
will never match the same note on the next import.

Read the id as a string from the source text. `JSON.parse`'s reviver gets the
source as its third argument (Chrome 114+, and Node 22+, which `node --test`
needs anyway):

```js
JSON.parse(raw, (key, value, ctx) =>
  key === 'id' && typeof value === 'number' && !Number.isSafeInteger(value) ? ctx.source : value);
```

That keeps the 19 digits as a string. The user's 9-digit id is safe either way.

## Sources

- https://developers.youversion.com/sign-in-apis
- https://developers.youversion.com/api/highlights
- https://developers.youversion.com/api/data-exchange
- https://bible.com/privacy
- https://apps.apple.com/us/app/bible/id282935706
- https://github.com/tushortz/youversion-bible-client
- https://faith.tools/bible-apis
