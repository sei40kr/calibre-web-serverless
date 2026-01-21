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
	id: string;
	title: string;
	sortTitle?: string;
	authorIds: string[];
	seriesId?: string;
	seriesIndex?: number;
	tagIds: string[];
	publisher?: string;
	pubDate?: Date;
	identifiers: Identifier[];
	language?: string;
	description?: string;
	rating?: number;
	format: string;
	fileSize: number;
	coverFormat?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface BookUploadFormData {
	title: string;
	file: File[];
}
