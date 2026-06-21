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

## Download delivery (signed URLs)

In production, OPDS book files and covers are delivered by issuing a **V4 signed
URL (15-minute expiry) and returning a 302 redirect** (the emulator streams
through the function instead, since it does not support signing).

- Signing goes through the IAM signBlob API, so the runtime service account is
  granted the Token Creator role on its own identity (via Terraform).
- Trade-off: a signed URL is accessible without authentication while it is valid.
  Keeping the expiry short limits the exposure.

## Secrets and configuration

The **Firebase Web API key** is a public value (it ships in the client config)
and is not a secret. It is passed to the OPDS function via the
`OPDS_WEB_API_KEY` environment variable (for the Identity Toolkit call).

## Planned improvements

- **Adopt OAuth following the OPDS spec**: replace Basic auth with the OAuth flow
  defined by Authentication for OPDS, so clients no longer hold the real Firebase
  password and access can be granted with a narrow, revocable scope.
  `functions/src/opds/auth.ts` keeps verification behind a replaceable interface,
  so this migration needs no changes to feed generation or delivery.
