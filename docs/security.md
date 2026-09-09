# Security Notes

This document covers the security model of the OPDS catalog, the trade-offs we
are aware of, and planned improvements.

## OPDS endpoint: HTTP Basic authentication (deprecated)

The OPDS catalog (served at `/opds`) uses **HTTP Basic authentication**,
chosen to prioritize client compatibility and a minimal implementation. The
client sends `Authorization: Basic base64(email:password)`, and the Cloud
Function verifies it against the Identity Toolkit REST API
(`accounts:signInWithPassword`) to obtain the uid.

- username = the Firebase account email
- password = **the actual Firebase login password**

### Why it is discouraged

Even over HTTPS, Basic auth has properties that make it unsuitable as a modern
authentication scheme:

1. **Credentials are sent on every request.** Feeds, covers, and downloads all
   carry the email/password, widening the attack surface.
2. **The client must retain the real password.** To send it on every request the
   OPDS client has to keep the Firebase password around — how securely (plaintext
   vs. an OS keychain) is up to the client. If the device is compromised, the
   entire Firebase account, including web login, can be exposed.
3. **Revocation is hard.** There is no way to disable only OPDS access; the only
   remedy is changing the Firebase password, which affects every client and the
   web login.
4. **Scope cannot be narrowed.** The verified session is equivalent to full
   account access; a read-only OPDS scope cannot be granted.

### Current mitigations

- **HTTPS only** (Cloud Functions / Hosting are HTTPS-only).
- Credentials and ID tokens are **never logged**.
- **Strict uid scoping**: every Firestore/Storage access is fixed to
  `users/{uid}/...` for the authenticated uid. The admin SDK bypasses security
  rules, so the function never relies on them and constrains IDs to `[^/]+` to
  prevent path traversal.
- Brute-force resistance relies on Identity Toolkit throttling
  (`TOO_MANY_ATTEMPTS_TRY_LATER` → `429`).

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
- **Not** enforced on `identitytoolkit.googleapis.com`: the OPDS function
  verifies Basic-auth credentials against it server-side and has no App Check
  token to send, so enforcing there would lock out every OPDS client.
- Local development and the E2E run talk to the emulators, which have no App
  Check backend, so the client skips initialisation when the site key is absent
  and the callables skip enforcement under `FUNCTIONS_EMULATOR`.

**Deploy before you enforce.** Enforcement is immediate and all-or-nothing: a
deployed client without the site key stops working the moment it lands. In a
new project, create the key first (`terraform apply` targeted at the reCAPTCHA
key), deploy a web build carrying it, then apply the rest.

## Secrets and configuration

The **Firebase Web API key** is a public value (it ships in the client config)
and is not a secret. It is passed to the OPDS function via the
`OPDS_WEB_API_KEY` environment variable (for the Identity Toolkit call).

The **Google Books API key** (raises the metadata-search quota) _is_ a secret:
stored in **Secret Manager** (`GOOGLE_BOOKS_API_KEY`, via Terraform) and bound to
`searchBookMetadata` only when deployed (the emulator runs keyless, using
`.envrc.local` if present). The runtime service account holds
`roles/secretmanager.secretAccessor` on it.

## Planned improvements

- **Adopt OAuth following the OPDS spec**: replace Basic auth with the OAuth flow
  defined by Authentication for OPDS, so clients no longer hold the real Firebase
  password and access can be granted with a narrow, revocable scope.
  `functions/src/opds/auth.ts` keeps verification behind a replaceable interface,
  so this migration needs no changes to feed generation or delivery.
