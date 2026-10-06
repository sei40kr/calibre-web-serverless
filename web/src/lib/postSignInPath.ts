const DEFAULT_PATH = "/dashboard";

/**
 * Where to go after signing in, from the login page's `?next=` parameter.
 * Only a same-origin path is honoured, so the parameter cannot turn the login
 * page into an open redirect; anything else falls back to the dashboard.
 */
export function postSignInPath(search: string): string {
	const next = new URLSearchParams(search).get("next");
	if (!next) return DEFAULT_PATH;
	// "//host" and "/\host" are protocol-relative to browsers; resolving against
	// a throwaway origin catches those and every other way out of the site.
	const base = "https://origin.invalid";
	let url: URL;
	try {
		url = new URL(next, base);
	} catch {
		return DEFAULT_PATH;
	}
	if (url.origin !== base || !next.startsWith("/")) return DEFAULT_PATH;
	return `${url.pathname}${url.search}${url.hash}`;
}
