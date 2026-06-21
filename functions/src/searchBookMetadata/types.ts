import type { BookMetadataSearchResult } from "@calibre-web-serverless/domain/models/bookMetadataSearch";

/**
 * A pluggable e-book metadata source. The search usecase queries every
 * registered provider in parallel, so adding a new store (Amazon, Rakuten Kobo,
 * etc.) is just a matter of implementing this interface and registering it in
 * `./providers` — no changes to the callable or the client are required.
 *
 * Declare concrete providers with `as const satisfies MetadataProvider` (not a
 * type annotation) so the literal `source` is preserved; the registry derives
 * the `MetadataSource` union and `METADATA_SOURCES` list from it automatically.
 */
export interface MetadataProvider {
	/** Stable key, mirrored onto each result's `source` (a `MetadataSource`). */
	readonly source: string;
	/** Human-readable name, mirrored onto each result's `sourceName`. */
	readonly sourceName: string;
	/**
	 * Search the source for `query`, returning at most `maxResults` normalised
	 * results (the caller decides the cap, not the provider). Should reject on
	 * transport/parse failure so the usecase can report a per-source error
	 * without failing the whole search.
	 */
	search(
		query: string,
		maxResults: number,
	): Promise<BookMetadataSearchResult[]>;
}
