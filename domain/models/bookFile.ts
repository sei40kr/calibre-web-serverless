/**
 * Formats accepted for upload. Extraction support is narrower; being listed
 * here only means the file can be stored and served.
 */
export const BOOK_FILE_FORMATS = [
	"epub",
	"pdf",
	"mobi",
	"azw",
	"azw3",
	"fb2",
	"txt",
] as const;

export type BookFileFormat = (typeof BOOK_FILE_FORMATS)[number];

export const BookFileFormat = {
	from(value: string): BookFileFormat | undefined {
		const lower = value.toLowerCase();
		return BOOK_FILE_FORMATS.find((format) => format === lower);
	},
};

export type BookFileStatus = "processing" | "ready" | "error";

/**
 * Why processing a book file failed. Presentation maps codes to user-facing
 * messages; the model never stores message text.
 */
export type BookProcessingErrorCode =
	| "unsupported-format"
	| "extraction-failed";

/** One stored file of a book. A book owns one file per format at most. */
export interface BookFile {
	format: BookFileFormat;
	fileSize: number;
	status: BookFileStatus;
	errorCode: BookProcessingErrorCode | null;
	addedAt: Date | null;
}

/** Files that are fully stored and downloadable. */
export function readyFiles(files: BookFile[]): BookFile[] {
	return files.filter((file) => file.status === "ready");
}
