import type {
	BookMetadataSearchRequest,
	BookMetadataSearchResponse,
	BookMetadataSearchResult,
	BookMetadataSourceError,
} from "@calibre-web-serverless/domain/models/bookMetadataSearch";
import { providers } from "./providers";
import type { MetadataProvider } from "./types";

/** Max results requested from each source per search. */
const MAX_RESULTS_PER_SOURCE = 10;

function errorMessage(reason: Error | string): string {
	return reason instanceof Error ? reason.message : reason;
}

/**
 * Run a metadata search across the selected providers in parallel. A failing
 * provider is reported in `errors` but never fails the whole search, so partial
 * results from healthy sources still reach the user.
 */
export async function searchBookMetadata(
	request: BookMetadataSearchRequest,
	registry: MetadataProvider[] = providers,
): Promise<BookMetadataSearchResponse> {
	const query = request.query.trim();
	if (!query) return { results: [], errors: [] };

	const requested = request.sources;
	const selected =
		requested && requested.length > 0
			? registry.filter((p) => requested.includes(p.source))
			: registry;

	const settled = await Promise.allSettled(
		selected.map((provider) => provider.search(query, MAX_RESULTS_PER_SOURCE)),
	);

	const results: BookMetadataSearchResult[] = [];
	const errors: BookMetadataSourceError[] = [];
	settled.forEach((outcome, index) => {
		const provider = selected[index];
		if (outcome.status === "fulfilled") {
			results.push(...outcome.value);
		} else {
			errors.push({
				source: provider.source,
				sourceName: provider.sourceName,
				message: errorMessage(outcome.reason),
			});
		}
	});

	return { results, errors };
}
