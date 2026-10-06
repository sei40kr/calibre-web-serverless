// The web half of the Authentication for OPDS 1.0 Implicit Grant (see
// functions/src/opds/auth.ts for the server half). An OPDS reader opens
// /authorize/opds in a browser; once the user approves, we hand the access token
// to the reader through the shared OPDS callback URI.

// Every OPDS client shares this callback; spec §3.4.2 requires it. Spelled both
// with and without the trailing slash in the wild, so both are accepted.
const DEFAULT_REDIRECT_URI = "opds://authorize/";
const ALLOWED_REDIRECT_URIS = new Set([
	"opds://authorize/",
	"opds://authorize",
]);

/** Path, relative to the site origin, of the Authentication Document. */
const AUTH_DOCUMENT_PATH = "/opds/auth";

export interface OpdsAuthorizeRequest {
	redirectUri: string;
	state: string | null;
}

/**
 * Validate the query an OPDS reader opened the consent page with. Returns null
 * when the request must not be answered by redirect (RFC 6749 §4.2.2.1): an
 * unrecognised redirect_uri, or a response_type other than the implicit
 * grant's "token". The fixed allowlist is what keeps the token from being sent
 * anywhere but an OPDS reader.
 */
export function parseOpdsAuthorizeRequest(
	params: URLSearchParams,
): OpdsAuthorizeRequest | null {
	const redirectUri = params.get("redirect_uri") ?? DEFAULT_REDIRECT_URI;
	if (!ALLOWED_REDIRECT_URIS.has(redirectUri)) return null;
	const responseType = params.get("response_type");
	if (responseType !== null && responseType !== "token") return null;
	return { redirectUri, state: params.get("state") };
}

function callbackUrl(
	request: OpdsAuthorizeRequest,
	origin: string,
	fields: Record<string, string>,
): string {
	const query = new URLSearchParams({
		// The reader matches the token to the catalog by the document's id.
		id: `${origin}${AUTH_DOCUMENT_PATH}`,
		...fields,
	});
	if (request.state !== null) query.set("state", request.state);
	return `${request.redirectUri}?${query.toString()}`;
}

/** Where to send the reader once the user approves. */
export function buildOpdsTokenCallbackUrl(
	request: OpdsAuthorizeRequest,
	origin: string,
	token: { accessToken: string; expiresIn: number },
): string {
	return callbackUrl(request, origin, {
		access_token: token.accessToken,
		token_type: "bearer",
		expires_in: String(token.expiresIn),
	});
}

/** Where to send the reader once the user declines. */
export function buildOpdsDeniedCallbackUrl(
	request: OpdsAuthorizeRequest,
	origin: string,
): string {
	return callbackUrl(request, origin, { error: "access_denied" });
}
