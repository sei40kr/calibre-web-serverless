// OPDS clients authenticate with OAuth 2.0 bearer tokens, as defined by
// Authentication for OPDS 1.0 (https://drafts.opds.io/authentication-for-opds-1.0)
// using its Implicit Grant flow: the client opens the `authenticate` link in a
// browser, the signed-in user approves it on the web app (/authorize/opds), and
// the web app hands the token back to the client via the shared OPDS callback
// URI. The client never sees the account password.

export const AUTH_DOCUMENT_TYPE = "application/opds-authentication+json";
export const AUTH_DOCUMENT_REL = "http://opds-spec.org/auth/document";

const IMPLICIT_GRANT_TYPE = "http://opds-spec.org/auth/oauth/implicit";

/** Root-relative path of the Authentication Document. */
export const AUTH_DOCUMENT_PATH = "/opds/auth";
/** Root-relative path of the web app's authorization (consent) page. */
export const AUTHORIZE_PATH = "/authorize/opds";

/**
 * Extract the token from an `Authorization: Bearer <token>` header (RFC 6750
 * §2.1). Returns null for a missing header, another scheme, or an empty token.
 */
export function parseBearerToken(header: string | undefined): string | null {
	if (!header) return null;
	const match = header.match(/^Bearer\s+([A-Za-z0-9\-._~+/]+=*)\s*$/i);
	return match ? match[1] : null;
}

/**
 * The Authentication Document. `origin` is the public origin of the catalog
 * (e.g. "https://example.web.app"); the spec makes `id` the document's
 * canonical URL, and clients key the token they receive by it.
 */
export function buildAuthenticationDocument(origin: string): object {
	return {
		id: `${origin}${AUTH_DOCUMENT_PATH}`,
		title: "Calibre-Web",
		description:
			"Sign in to Calibre-Web in your browser and allow this reader to access your library.",
		authentication: [
			{
				type: IMPLICIT_GRANT_TYPE,
				links: [
					{
						rel: "authenticate",
						href: `${origin}${AUTHORIZE_PATH}`,
						type: "text/html",
					},
				],
			},
		],
	};
}
