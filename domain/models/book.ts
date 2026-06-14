import type { Identifier } from "./identifier";
import type { Language } from "./language";

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
	format: string;
	fileSize: number;
	/** Whether a metadata-extracted cover exists. */
	hasCover: boolean;
	/** Whether a user-uploaded custom cover is active. */
	hasCustomCover: boolean;
	status: BookStatus;
	errorMessage: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
}
