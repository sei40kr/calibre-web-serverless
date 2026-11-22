import type { BookStatus } from "@calibre-web-serverless/domain/models/book";
import type {
	BookFileStatus,
	BookProcessingErrorCode,
} from "@calibre-web-serverless/domain/models/bookFile";
import {
	lastReadIn,
	type ReadingPositions,
	type ReadingProgress,
	type ReadingStatus,
	unreadProgress,
} from "@calibre-web-serverless/domain/models/readingProgress";

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

/** Positions are plain numbers and strings, so they are stored as is. */
export interface ReadingProgressDocument<Time> {
	status: ReadingStatus;
	lastReadAt: Time | null;
	lastFormat: keyof ReadingPositions | null;
	positions: ReadingPositions;
}

// An unread book still stores every field: sorting by `lastReadAt` drops
// documents without it.
export const unreadProgressDocument: ReadingProgressDocument<never> = {
	status: "unread",
	lastReadAt: null,
	lastFormat: null,
	positions: {},
};

export const toReadingProgressDocument = (
	reading: ReadingProgress,
): ReadingProgressDocument<Date> =>
	reading.status === "unread" ? unreadProgressDocument : reading;

/**
 * The progress a stored document holds. One that contradicts itself, which
 * only a write from outside this repository could leave, keeps what is
 * consistent in it: a book read with no position stays read, anything else
 * reads as unread.
 */
export const toReadingProgress = (
	d: ReadingProgressDocument<{ toDate(): Date }> | undefined,
): ReadingProgress => {
	const lastReadAt = d?.lastReadAt?.toDate();
	if (!d || d.status === "unread" || !lastReadAt) return unreadProgress;
	const current = d.lastFormat
		? lastReadIn(d.lastFormat, d.positions ?? {})
		: null;
	if (current) return { status: d.status, lastReadAt, ...current };
	return d.status === "read"
		? { status: "read", lastReadAt, lastFormat: null, positions: {} }
		: unreadProgress;
};

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
	/** Ids of the bookshelves (`users/{uid}/bookshelves`) this book belongs to. */
	bookshelfIds: string[];
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
	/** Absent on books created before reading progress existed: unread. */
	reading?: ReadingProgressDocument<Time>;
	createdAt: Time | null;
	updatedAt: Time | null;
}
