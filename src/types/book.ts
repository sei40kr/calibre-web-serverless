import type { Timestamp } from "firebase/firestore";

export const IdentifierType = {
	ISBN: "isbn",
	ISBN13: "isbn13",
	AMAZON: "amazon",
	GOOGLE: "google",
	GOODREADS: "goodreads",
} as const;

export type IdentifierType =
	(typeof IdentifierType)[keyof typeof IdentifierType];

export interface Identifier {
	type: IdentifierType;
	value: string;
}

export interface Book {
	title: string;
	sortTitle?: string;
	authorIds: string[];
	seriesId?: string;
	seriesIndex?: number;
	tagIds: string[];
	publisher?: string;
	pubDate?: Timestamp;
	identifiers: Identifier[];
	language?: string;
	description?: string;
	rating?: number;
	format: string;
	fileSize: number;
	coverFormat?: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

export interface BookUploadFormData {
	title: string;
	file: File[];
}
