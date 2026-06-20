import type { BookStatus } from "@calibre-web-serverless/domain/models/book";

export interface IdentifierDocument {
	type: string;
	value: string;
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
	format: string;
	fileSize: number;
	hasCover: boolean;
	hasCustomCover: boolean;
	status: BookStatus;
	errorMessage: string | null;
	createdAt: Time | null;
	updatedAt: Time | null;
}
