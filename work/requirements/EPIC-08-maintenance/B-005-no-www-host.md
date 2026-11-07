# B-005 — A bare bible.com host is not matched

| Field | Value |
|---|---|
| Epic | EPIC-08 Maintenance |
| Status | Not started |
| Type | Pre-existing, needs investigation first |
| Blocks release | No |
| Size | XS to investigate, S to fix |
| Risk | Low |

## The observation

The content script matches exactly one pattern:

```jsonc
"matches": ["https://www.bible.com/*"]
```

A URL on `https://bible.com/...` without `www` is **not** matched, and the
extension does nothing there. The same applies to any other host bible.com may
serve from.

`isOwnSiteUrl()` in `content.js:444` applies the same rule, deliberately and
correctly — it is a security gate on a value that reaches `location.assign()`,
and loosening it carelessly would be a real bug.

## Status: investigate before fixing

**This may not be a bug at all.** If bible.com issues a permanent redirect from
the bare host to `www`, the narrow pattern is correct and adding a second one
would widen the extension's host access for no benefit.

Extensions should request the narrowest host access that works. Widening it
affects the store review and what the install prompt tells users.

## Investigation

1. Open `https://bible.com/bible/111/JHN.1.NIV` and see whether it redirects to
   `www`, and with what status.
2. Check for any other host that serves the reader.
3. Check whether a user can reach a reader page that stays on the bare host —
   from a shared link, a bookmark, or an app hand-off.

**If it always redirects: close this as not-a-bug**, and record the finding in
`work/understandings/bible-com/01-urls-and-routing.md` so the question is not
reopened.

## If it is real

**R1.** Add the host to `content_scripts.matches`. Do **not** use a wildcard such
as `https://*.bible.com/*` unless the investigation shows a specific subdomain is
needed — that grants access to every subdomain, including any that handles
accounts.

**R2.** Update `isOwnSiteUrl()` to accept the additional host, keeping its
existing discipline: compare the **origin**, require `https:`, and never use a
substring test. The current comment explains why — hostname alone would accept
`http:`, and a substring would accept `www.bible.com.evil.test`. Preserve that
reasoning.

**R3.** Verify every URL assumption still holds on the other host: `parseUrl()`,
the `vid` classes, the theme classes, the bottom-chrome variables.

**R4.** Record what was found in
`work/understandings/bible-com/01-urls-and-routing.md`, replacing the current
note that only `www` is matched.

## Acceptance

- [ ] The redirect behaviour of the bare host is established and written down
- [ ] If it always redirects: closed as not-a-bug, with the finding recorded
- [ ] If not: the host is added **without** a subdomain wildcard
- [ ] `isOwnSiteUrl()` still rejects `http:`, other origins, and lookalike hosts
      such as `www.bible.com.evil.test`
- [ ] Alignment, separators and the dock work on any newly matched host
- [ ] `work/understandings/bible-com/01-urls-and-routing.md` reflects the truth

## Notes

The valuable outcome here is the recorded answer, whichever way it goes. "Why
does this only match `www`?" is a question that will otherwise be asked again
every time someone reads the manifest.
