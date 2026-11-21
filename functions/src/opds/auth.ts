// OPDS readers authenticate with Authentication for OPDS 1.0's OAuth implicit
// grant: an unauthenticated request gets the Authentication Document, the
// reader opens its `authenticate` link (the web app's consent page) and comes
// back with a bearer token bound to one revocable, read-only OPDS app.

export const AUTH_DOCUMENT_TYPE = "application/opds-authentication+json";

/** The token from an `Authorization: Bearer <token>` header, or null. */
export function parseBearerToken(header: string | undefined): string | null {
	const match = header?.match(/^Bearer\s+(\S+)$/i);
	return match ? match[1] : null;
}

/**
 * The Authentication Document of the catalog served at `origin`. Its `id`,
 * which the reader matches the returned token against, comes from the origin
 * only, never from the request, so a crafted link can't make a reader hand
 * the token to another catalog. The web app's consent page answers with the
 * same `id`.
 */
export function buildAuthDocument(origin: string): string {
	return JSON.stringify({
		id: `${origin}/opds/auth`,
		title: "Calibre-Web Serverless",
		description: "Sign in and allow this app to read your library.",
		authentication: [
			{
				type: "http://opds-spec.org/auth/oauth/implicit",
				links: [
					{
						rel: "authenticate",
						href: `${origin}/oauth/authorize`,
						type: "text/html",
					},
				],
			},
		],
	});
}
