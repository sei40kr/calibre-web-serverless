import type { BookMetadataSearchResult } from "@calibre-web-serverless/domain/models/bookMetadataSearch";
import type { MetadataProvider } from "../types";

/**
 * Google Play Books provider.
 *
 * Google Play Books is backed by the same catalogue as the public Google Books
 * API (`www.googleapis.com/books/v1`), and each result's `infoLink` points back
 * into the Play Store. We query that API rather than scraping the Play Store's
 * obfuscated HTML, which is the same approach upstream calibre-web takes for its
 * Google source — far more robust and stable than HTML scraping.
 */

const SOURCE = "google_play_books";
const SOURCE_NAME = "Google Play Books";

const ENDPOINT = "https://www.googleapis.com/books/v1/volumes";

// Maps Google's industry-identifier scheme names onto domain IdentifierType
// values (see domain/models/identifier.ts).
const IDENTIFIER_TYPE_BY_SCHEME: Record<string, string> = {
	ISBN_10: "isbn",
	ISBN_13: "isbn13",
};

interface GoogleIndustryIdentifier {
	type?: string;
	identifier?: string;
}

interface GoogleVolumeInfo {
	title?: string;
	subtitle?: string;
	authors?: string[];
	publisher?: string;
	publishedDate?: string;
	description?: string;
	industryIdentifiers?: GoogleIndustryIdentifier[];
	categories?: string[];
	language?: string;
	imageLinks?: Record<string, string>;
	infoLink?: string;
	canonicalVolumeLink?: string;
}

interface GoogleVolume {
	id?: string;
	volumeInfo?: GoogleVolumeInfo;
}

interface GoogleVolumesResponse {
	items?: GoogleVolume[];
}

/** Build the Google Books volumes query URL. */
export function buildSearchUrl(
	query: string,
	maxResults: number,
	options: { country?: string; apiKey?: string } = {},
): string {
	const params = new URLSearchParams({
		q: query,
		maxResults: String(maxResults),
		printType: "books",
		// The API requires a country for catalogue/availability resolution.
		country: options.country ?? "US",
	});
	if (options.apiKey) params.set("key", options.apiKey);
	return `${ENDPOINT}?${params.toString()}`;
}

/**
 * Promote a Google cover thumbnail to a larger, https, un-curled image. The
 * thumbnail URLs carry `zoom`/`edge` query params we can tweak for a cleaner,
 * higher-resolution cover.
 */
export function upgradeCoverUrl(url: string | undefined): string | null {
	if (!url) return null;
	return url
		.replace(/^http:\/\//, "https://")
		.replace(/&edge=curl/, "")
		.replace(/zoom=\d+/, "zoom=2");
}

/** Convert a single Google volume into our normalised result shape. */
export function mapVolume(
	volume: GoogleVolume,
): BookMetadataSearchResult | null {
	const info = volume.volumeInfo;
	if (!volume.id || !info?.title) return null;

	const identifiers: BookMetadataSearchResult["identifiers"] = [];
	for (const entry of info.industryIdentifiers ?? []) {
		const type = entry.type ? IDENTIFIER_TYPE_BY_SCHEME[entry.type] : undefined;
		if (type && entry.identifier) {
			identifiers.push({ type, value: entry.identifier });
		}
	}
	// The volume id is itself a Google Books identifier.
	identifiers.push({ type: "google", value: volume.id });

	return {
		source: SOURCE,
		sourceName: SOURCE_NAME,
		id: volume.id,
		title: info.title,
		authors: info.authors ?? [],
		publisher: info.publisher ?? null,
		publishedDate: info.publishedDate ?? null,
		description: info.description ?? null,
		languages: info.language ? [info.language] : [],
		identifiers,
		tags: info.categories ?? [],
		coverUrl: upgradeCoverUrl(
			info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail,
		),
		infoUrl: info.canonicalVolumeLink ?? info.infoLink ?? null,
	};
}

export const googlePlayBooksProvider = {
	source: SOURCE,
	sourceName: SOURCE_NAME,
	async search(
		query: string,
		maxResults: number,
	): Promise<BookMetadataSearchResult[]> {
		const url = buildSearchUrl(query, maxResults, {
			country: process.env.GOOGLE_BOOKS_COUNTRY,
			apiKey: process.env.GOOGLE_BOOKS_API_KEY,
		});
		const res = await fetch(url, {
			headers: { Accept: "application/json" },
		});
		if (!res.ok) {
			// 429 is the keyless public-quota limit (or a per-project quota with a
			// key). Surface a calmer, actionable message instead of a raw status.
			if (res.status === 429) {
				throw new Error(
					"Rate limited by Google Books. Please wait a moment and try again.",
				);
			}
			throw new Error(`Google Books request failed (${res.status})`);
		}
		const body = (await res.json()) as GoogleVolumesResponse;
		return (body.items ?? [])
			.map(mapVolume)
			.filter((r): r is BookMetadataSearchResult => r !== null);
	},
	// `as const` keeps `source` a literal (so the registry can derive the
	// MetadataSource union); `satisfies` still checks the shape.
} as const satisfies MetadataProvider;
