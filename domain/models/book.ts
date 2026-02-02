import type { Identifier } from "./identifier";
import type { Language } from "./language";

export interface Book {
	id: string;
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
	coverFormat: string | null;
	createdAt: Date;
	updatedAt: Date;
}
