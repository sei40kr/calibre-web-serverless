/**
 * Cross-package contract for searching book metadata on the internet.
 *
 * These types are exchanged verbatim over a Firebase callable function, so every
 * field must be JSON-serialisable: identifiers and languages are plain strings
 * (codes), not the `Identifier`/`Language` domain classes. The web layer maps
 * them into domain models when applying a result to the edit form.
 */

/** A single book match returned by an e-book store / metadata source. */
export interface BookMetadataSearchResult {
	/** Stable source key, e.g. `"google_play_books"`. */
	source: string;
	/** Human-readable source name shown in the UI, e.g. `"Google Play Books"`. */
	sourceName: string;
	/** Source-unique id, used as a stable React key (e.g. the store volume id). */
	id: string;
	title: string;
	authors: string[];
	publisher: string | null;
	/**
	 * Publication date exactly as the source provides it: a full ISO date,
	 * `YYYY-MM`, or a bare `YYYY`. The consumer normalises it.
	 */
	publishedDate: string | null;
	description: string | null;
	/** ISO 639-1 language codes. */
	languages: string[];
	/** Identifiers keyed by domain `IdentifierType.value` (e.g. `isbn13`). */
	identifiers: Array<{ type: string; value: string }>;
	/** Free-form subject/category tags. */
	tags: string[];
	/** Remote cover image URL, fetched on demand when a result is chosen. */
	coverUrl: string | null;
	/** Link to the book's page in the source store. */
	infoUrl: string | null;
}

/** Parameters for a metadata search. */
export interface BookMetadataSearchRequest {
	query: string;
	/**
	 * Restrict the search to specific sources by their `source` key. When omitted
	 * or empty, every available source is queried in parallel.
	 */
	sources?: string[];
}

/** A source that failed, surfaced so partial results can still be shown. */
export interface BookMetadataSourceError {
	source: string;
	/** Human-readable source name for display, e.g. `"Google Play Books"`. */
	sourceName: string;
	message: string;
}

/** Aggregated response across all queried sources. */
export interface BookMetadataSearchResponse {
	results: BookMetadataSearchResult[];
	errors: BookMetadataSourceError[];
}
