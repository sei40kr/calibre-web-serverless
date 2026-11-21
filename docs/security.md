# Security Notes

This document covers the security model of the OPDS catalog and the trade-offs
we are aware of.

## OPDS endpoint: OAuth (Authentication for OPDS)

The OPDS catalog (served at `/opds`) authorizes each reader app through
[Authentication for OPDS 1.0](https://drafts.opds.io/authentication-for-opds-1.0)'s
OAuth implicit grant, so readers never hold the account password. A token is
`<uid>.<appId>.<secret>`; only the secret's SHA-256 is stored, in
`users/{uid}/opdsApps/{appId}`, and the function compares hashes in constant
time.

- **Read-only, per app**: a token only reaches the OPDS feeds and downloads, and
  each app is listed in Settings › OPDS, where revoking deletes its document and
  the token stops working on the next request. Deleting the account deletes
  every app with the rest of `users/{uid}`.
- **No open redirect**: the callback is always `opds://authorize/`, and the `id`
  is derived from the page's own origin, never from request parameters, so a
  crafted link can't send the token elsewhere or bind it to another catalog.
  The sign-in page's `next` parameter only accepts same-origin paths.
- **No expiry**: implicit-grant tokens have no refresh, so a token is valid
  until revoked. Revocation is the control; the last-used time (recorded at most
  every five minutes) helps spot a stale or unknown app.
- **Strict uid scoping**: every Firestore/Storage access is fixed to
  `users/{uid}/...` for the token's uid. The admin SDK bypasses security rules,
  so the function never relies on them and constrains IDs (in the token and the
  URL) to characters that can't escape a path segment.
- The token is never logged, and only the owner can read the hash (Firestore
  rules).

## Download delivery

### OPDS (signed URLs)

In production, OPDS book files and covers are delivered by issuing a **V4 signed
URL (15-minute expiry) and returning a 302 redirect** (the emulator streams
through the function instead, since it does not support signing).

- Signing goes through the IAM signBlob API, so the runtime service account is
  granted the Token Creator role on its own identity (via Terraform).
- Trade-off: a signed URL is accessible without authentication while it is valid.
  Keeping the expiry short limits the exposure.

### Web client (authenticated reads)

The web client does **not** use `getDownloadURL()`. A download URL carries a
token that reads the object with **no authentication and no expiry**, so the
Storage rules stop applying to it the moment it is created: wherever the URL
ends up — history, a `Referer`, a copied link — the book file or cover behind
it stays readable until the token is manually revoked.

Covers and book files are fetched with `getBytes()` instead, which carries the
signed-in user's credentials and is checked against the rules on every request,
and the bytes reach the reader as an **object URL** — resolvable only inside
the document that created it, and dead with it. The hook that requested one
revokes it when the cover or the reader goes away.

- No CORS configuration is needed: `firebasestorage.googleapis.com` answers the
  preflight with `Access-Control-Allow-Origin: *` and allows the `Authorization`
  header.
- Trade-off: the file is downloaded in full before it can be read, so pdf.js no
  longer serves a page from a byte range of a large PDF.

## Book metadata search (Cloud callables)

`searchBookMetadata` and `fetchBookMetadataCover` both **require auth**
(`request.auth`, else `unauthenticated`). Each search hits an external,
quota-limited/billed API (Google Books) and the cover fetch makes a server-side
download, so an open callable would invite an **API-cost / quota-exhaustion
attack**. Auth limits callers to signed-in accounts; `fetchBookMetadataCover` also
only fetches hosts on a Google allowlist (no open proxy).

**Future scraping providers:** a provider that _scrapes_ a site instead of using a
sanctioned API turns the callable into a request **amplifier** — a burst of
searches becomes a burst of outbound requests, making us a **DoS stepping-stone**
against that site (and risking IP bans / ToS violations). Before adding one: add
per-user + global rate limiting, cache by query, back off on `429`/`Retry-After`,
respect `robots.txt`/ToS, and keep the host allowlist.

## Account deletion (Cloud callable)

`deleteAccount` deletes the caller's whole library (everything under
`users/{uid}` in Firestore and Storage) and then their Auth user. It requires
auth and a sign-in from the last five minutes: the client re-authenticates with
the password just before calling, so a stolen session alone cannot wipe an
account. The runtime service account holds `roles/firebaseauth.admin` for the
user deletion.

## App Check

Auth answers _which account_ a request carries. App Check answers _which app_:
requests to Firestore, Cloud Storage and the callables must
also present a token proving they came from this web app running in a real
browser. Without it, anything holding an ID token — a script, a copied session,
a stolen refresh token — is indistinguishable from the app itself.

- Attestation uses **reCAPTCHA Enterprise** (score-based, no interaction). The
  site key is provisioned by Terraform and reaches the client as
  `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`.
- Enforced on `firestore.googleapis.com` and `firebasestorage.googleapis.com`;
  the callables enforce it themselves via `enforceAppCheck`.
- **Not** enforced on `identitytoolkit.googleapis.com` yet. OPDS no longer
  signs in through it, so enforcing there is a candidate follow-up.
- Local development and the E2E run talk to the emulators, which have no App
  Check backend, so the client skips initialisation when the site key is absent
  and the callables skip enforcement under `FUNCTIONS_EMULATOR`.

**Deploy before you enforce.** Enforcement is immediate and all-or-nothing: a
deployed client without the site key stops working the moment it lands. The
README's deploy section gives the rollout order for an environment that
already serves a client.

## Secrets and configuration

The **Firebase Web API key** is a public value (it ships in the client config)
and is not a secret.

The **Google Books API key** (raises the metadata-search quota) _is_ a secret:
stored in **Secret Manager** (`GOOGLE_BOOKS_API_KEY`, via Terraform) and bound to
`searchBookMetadata` only when deployed (the emulator runs keyless, using
`.envrc.local` if present). The runtime service account holds
`roles/secretmanager.secretAccessor` on it.
