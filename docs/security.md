# Security Notes

This document covers the security model of the OPDS catalog, the trade-offs we
are aware of, and planned improvements.

## OPDS endpoint: OAuth 2.0 bearer tokens

The OPDS catalog (served at `/opds`) authenticates with **OAuth 2.0 bearer
tokens** through the Implicit Grant flow of
[Authentication for OPDS 1.0](https://drafts.opds.io/authentication-for-opds-1.0).
HTTP Basic authentication is **not** supported: it made the reader send the
real Firebase password on every request, keep it around, and hold a credential
that could neither be scoped nor revoked on its own.

### Flow

1. An unauthenticated request (or one with a rejected token) gets `401` with
   the **Authentication Document** (`application/opds-authentication+json`) as
   its body, a `Link` header pointing at it (`/opds/auth`, itself public) and
   `WWW-Authenticate: Bearer`. The document offers only
   `http://opds-spec.org/auth/oauth/implicit`.
2. The reader opens the document's `authenticate` link — the web app's
   `/authorize/opds` — in a browser. A signed-out user signs in first and is
   brought back.
3. The user approves. The page calls the `issueOpdsAccessToken` callable (auth
   and App Check required), which mints the token.
4. The page redirects to the shared OPDS callback,
   `opds://authorize/?id=…&access_token=…&token_type=bearer&expires_in=…`, and
   the reader sends `Authorization: Bearer <token>` from then on.

### Token properties

- **Opaque and random** (256 bits), not a Firebase ID or refresh token, so it
  grants nothing outside `/opds`, and `/opds` itself is read-only (`GET`/`HEAD`).
- **Stored only as a SHA-256 hash** in the top-level `opdsAccessTokens`
  collection. No Firestore rule matches it, so clients can neither read nor
  write it; a Firestore TTL policy deletes documents after `expiresAt`.
- **Expires after 30 days.** The Implicit Grant has no refresh token; the
  reader sends the user through the browser again.
- **Revocable per account.** Every request re-checks the owner: a deleted or
  disabled account, or a token issued before the account's
  `tokensValidAfterTime` (bumped by `revokeRefreshTokens` and by a password
  change), is rejected. Revoking one reader alone is not supported yet.

### Redirect URI and the consent page

- `redirect_uri` must be `opds://authorize/` (or `opds://authorize`); anything
  else, or a `response_type` other than `token`, is shown as an error instead of
  redirected, so the token cannot be sent to a web origin.
- `/authorize/opds` is served with `frame-ancestors 'none'` /
  `X-Frame-Options: DENY`, so the Allow button cannot be clickjacked.
- The login page's `?next=` (used to return to the consent page) accepts only a
  same-origin path, so it is not an open redirect.
- The `opds://` scheme is shared by every OPDS reader: on a device where a
  malicious app registered it, that app could receive the token. This is
  inherent to the spec's shared client identifier.

### Mitigations

- **HTTPS only** (Cloud Functions / Hosting are HTTPS-only).
- Tokens are **never logged**.
- **Strict uid scoping**: every Firestore/Storage access is fixed to
  `users/{uid}/...` for the uid the token resolves to. The admin SDK bypasses
  security rules, so the function never relies on them and constrains IDs to
  `[^/]+` to prevent path traversal.
- Guessing a 256-bit token is infeasible, so no brute-force throttling is
  needed on `/opds`.

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

## App Check

Auth answers _which account_ a request carries. App Check answers _which app_:
requests to Firestore, Cloud Storage and the metadata-search callables must
also present a token proving they came from this web app running in a real
browser. Without it, anything holding an ID token — a script, a copied session,
a stolen refresh token — is indistinguishable from the app itself.

- Attestation uses **reCAPTCHA Enterprise** (score-based, no interaction). The
  site key is provisioned by Terraform and reaches the client as
  `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`.
- Enforced on `firestore.googleapis.com` and `firebasestorage.googleapis.com`;
  the two callables enforce it themselves via `enforceAppCheck`.
- **Not** enforced on `identitytoolkit.googleapis.com` yet. OPDS Basic auth,
  which verified passwords there server-side without an App Check token, used
  to rule it out; OPDS no longer calls it, so enforcing it is a possible
  follow-up.
- Local development and the E2E run talk to the emulators, which have no App
  Check backend, so the client skips initialisation when the site key is absent
  and the callables skip enforcement under `FUNCTIONS_EMULATOR`.

**Deploy before you enforce.** Enforcement is immediate and all-or-nothing: a
deployed client without the site key stops working the moment it lands. In a
new project, create the key first (`terraform apply` targeted at the reCAPTCHA
key), deploy a web build carrying it, then apply the rest.

## Secrets and configuration

The **Firebase Web API key** is a public value (it ships in the client config)
and is not a secret. The functions do not need it.

The **Google Books API key** (raises the metadata-search quota) _is_ a secret:
stored in **Secret Manager** (`GOOGLE_BOOKS_API_KEY`, via Terraform) and bound to
`searchBookMetadata` only when deployed (the emulator runs keyless, using
`.envrc.local` if present). The runtime service account holds
`roles/secretmanager.secretAccessor` on it.

## Planned improvements

- **Revoke a single OPDS reader**: list a user's OPDS tokens in the web app and
  let them delete one, instead of revoking every session of the account.
