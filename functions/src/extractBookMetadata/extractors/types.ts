export interface ExtractedMetadata {
	title: string | null;
	authors: string[];
	description: string | null;
	language: string | null;
	publisher: string | null;
	pubDate: Date | null;
	identifiers: Array<{ type: string; value: string }>;
	coverImage: Buffer | null;
}
