import type { BookFile, BookProcessingErrorCode } from "./bookFile";
import type { Identifier } from "./identifier";
import type { Language } from "./language";

/**
 * Lifecycle of the book as a whole. "processing" and "error" only describe
 * the initial upload's metadata extraction; once ready, a book stays ready
 * and later-added formats track progress on their own BookFile status.
 */
export type BookStatus = "processing" | "ready" | "error";

export interface Book {
	id: string;
	userId: string;
	title: string;
	sortTitle: string | null;
	authorIds: string[];
	seriesId: string | null;
	seriesIndex: number;
	tagIds: string[];
	publisherId: string | null;
	pubDate: Date | null;
	identifiers: Identifier[];
	languages: Language[];
	description: string | null;
	rating: number | null;
	/** Stored files, one per format. Never empty for a ready book. */
	files: BookFile[];
	/** Whether a metadata-extracted cover exists. */
	hasCover: boolean;
	/** Whether a user-uploaded custom cover is active. */
	hasCustomCover: boolean;
	status: BookStatus;
	errorCode: BookProcessingErrorCode | null;
	createdAt: Date | null;
	updatedAt: Date | null;
}
