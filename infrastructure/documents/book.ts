import type { BookStatus } from "@calibre-web-serverless/domain/models/book";
import type {
	BookFileStatus,
	BookProcessingErrorCode,
} from "@calibre-web-serverless/domain/models/bookFile";

export interface IdentifierDocument {
	type: string;
	value: string;
}

/**
 * One stored file of a book. Keyed by lowercase format in
 * `BookDocument.files`, so the format is not repeated inside the entry.
 */
export interface BookFileDocument<Time> {
	fileSize: number;
	status: BookFileStatus;
	errorCode: BookProcessingErrorCode | null;
	addedAt: Time | null;
}

/**
 * Firestore document schema for a book. Generic over the timestamp
 * representation so each service can bind its own SDK's `Timestamp`
 * (`firebase/firestore` on the web, `firebase-admin/firestore` in functions)
 * while sharing the field shape. The document id is the Firestore key, not a
 * stored field, so it is intentionally absent.
 */
export interface BookDocument<Time> {
	title: string;
	sortTitle: string | null;
	authorIds: string[];
	seriesId: string | null;
	seriesIndex: number;
	tagIds: string[];
	publisherId: string | null;
	pubDate: Time | null;
	identifiers: IdentifierDocument[];
	languages: string[];
	description: string | null;
	rating: number | null;
	/** Stored files, keyed by lowercase format. */
	files: Record<string, BookFileDocument<Time>>;
	/**
	 * True while any entry in `files` is "processing". Firestore cannot query
	 * into map values, so the reconcile job's collection-group query needs
	 * this flag.
	 */
	hasProcessingFile: boolean;
	hasCover: boolean;
	hasCustomCover: boolean;
	status: BookStatus;
	errorCode: BookProcessingErrorCode | null;
	createdAt: Time | null;
	updatedAt: Time | null;
}
