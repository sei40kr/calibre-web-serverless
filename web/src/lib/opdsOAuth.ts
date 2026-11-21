// Authentication for OPDS 1.0 (OAuth implicit grant) as the web app sees it.
// The catalog and its Authentication Document are served by the opds
// function, proxied under the web app's origin.

export const OPDS_CATALOG_PATH = "/opds";
export const OAUTH_AUTHORIZE_PATH = "/oauth/authorize";

/** Where the consent page sends the reader back with its answer. */
export const opdsCallbackUrl = (
	origin: string,
	answer:
		| { access_token: string; token_type: "bearer" }
		| { error: "access_denied" },
): string =>
	// `id` must equal the Authentication Document's id built by the function.
	`opds://authorize/?${new URLSearchParams({ id: `${origin}/opds/auth`, ...answer })}`;
