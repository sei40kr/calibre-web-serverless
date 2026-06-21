import type {
	BookMetadataSearchResponse,
	BookMetadataSearchResult,
} from "@calibre-web-serverless/domain/models/bookMetadataSearch";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

interface SearchRequest {
	query: string;
	sources?: string[];
}

interface FetchCoverRequest {
	url: string;
}

interface FetchCoverResponse {
	dataBase64: string;
	contentType: string;
}

const searchCallable = httpsCallable<SearchRequest, BookMetadataSearchResponse>(
	functions,
	"searchBookMetadata",
);

const fetchCoverCallable = httpsCallable<FetchCoverRequest, FetchCoverResponse>(
	functions,
	"fetchBookMetadataCover",
);

const contentTypeToExtension: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Client-side gateway to the metadata-search callables. Encapsulates the
 * Firebase Functions SDK so components/hooks deal only in domain types.
 */
export const bookMetadataSearchService = {
	/** Search e-book stores for metadata matching `query`. */
	async search(
		query: string,
		sources?: string[],
	): Promise<BookMetadataSearchResponse> {
		const { data } = await searchCallable({ query, sources });
		return data;
	},

	/**
	 * Download a chosen result's cover image (server-side, via a callable) and
	 * return it as a `File` ready to stage through the custom-cover upload path.
	 */
	async fetchCover(
		result: Pick<BookMetadataSearchResult, "coverUrl">,
	): Promise<File | null> {
		if (!result.coverUrl) return null;
		const { data } = await fetchCoverCallable({ url: result.coverUrl });
		const ext = contentTypeToExtension[data.contentType] ?? "jpg";
		const bytes = base64ToUint8Array(data.dataBase64);
		return new File([bytes], `cover.${ext}`, { type: data.contentType });
	},
};
