import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { fetchBookCover } from "./fetchCover";
import { METADATA_SOURCES, type MetadataSource } from "./providers";
import { searchBookMetadata } from "./search";

// Google Books API key, stored in Secret Manager and injected at runtime as
// process.env.GOOGLE_BOOKS_API_KEY (read by the Google Play Books provider).
const googleBooksApiKey = defineSecret("GOOGLE_BOOKS_API_KEY");

// The Books API works without a key; the emulator has no Secret Manager, so we
// only bind the secret when deployed and run keyless locally. Mirrors the
// FUNCTIONS_EMULATOR check the OPDS function uses.
const searchSecrets =
	process.env.FUNCTIONS_EMULATOR === "true" ? [] : [googleBooksApiKey];

/**
 * Validate the client-supplied source filter against the known source keys, so
 * only real sources reach the search and the value narrows to `MetadataSource`.
 * Unknown or non-string entries are dropped; an empty result means "all".
 */
function parseSources(raw: unknown): MetadataSource[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const known: readonly string[] = METADATA_SOURCES;
	const valid = raw.filter(
		(s): s is MetadataSource => typeof s === "string" && known.includes(s),
	);
	return valid.length > 0 ? valid : undefined;
}

/**
 * Search e-book stores for book metadata. Callable from the authenticated web
 * client; returns aggregated results plus per-source errors.
 */
export const searchBookMetadataFn = onCall(
	{ memory: "256MiB", timeoutSeconds: 30, secrets: searchSecrets },
	async (request) => {
		// Require an authenticated caller. Each search fans out to an external,
		// quota-limited/billed API (Google Books); an open callable would let
		// anyone burn that quota — an API-cost / quota-exhaustion attack. See
		// docs/security.md.
		if (!request.auth) {
			throw new HttpsError("unauthenticated", "Authentication required");
		}

		const data = (request.data ?? {}) as { query?: unknown; sources?: unknown };
		const query = typeof data.query === "string" ? data.query : "";
		if (!query.trim()) {
			throw new HttpsError("invalid-argument", "A search query is required");
		}
		const sources = parseSources(data.sources);

		return await searchBookMetadata({ query, sources });
	},
);

/**
 * Download a store cover image server-side, returning it base64-encoded so the
 * browser can stage it as a custom cover without cross-origin restrictions.
 */
export const fetchBookMetadataCoverFn = onCall(
	{ memory: "256MiB", timeoutSeconds: 30 },
	async (request) => {
		// Same rationale as searchBookMetadata: this performs a server-side
		// outbound fetch, so it must not be open to unauthenticated callers.
		if (!request.auth) {
			throw new HttpsError("unauthenticated", "Authentication required");
		}

		const data = (request.data ?? {}) as { url?: unknown };
		const url = typeof data.url === "string" ? data.url : "";
		if (!url) {
			throw new HttpsError("invalid-argument", "A cover URL is required");
		}

		try {
			return await fetchBookCover(url);
		} catch (err) {
			throw new HttpsError(
				"internal",
				err instanceof Error ? err.message : "Failed to fetch cover",
			);
		}
	},
);
