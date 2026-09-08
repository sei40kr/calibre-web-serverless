import {
	type BookFile,
	type BookFileFormat,
	readyFiles,
} from "@calibre-web-serverless/domain/models/bookFile";

/**
 * Formats the app has an in-browser reader for, in preference order: EPUB
 * reflows to the viewport (and supports vertical writing), so it wins over
 * PDF when a book has both.
 */
export const READABLE_BOOK_FORMATS = [
	"epub",
	"pdf",
] as const satisfies readonly BookFileFormat[];

export type ReadableBookFormat = (typeof READABLE_BOOK_FORMATS)[number];

/** The book's ready formats that can be read in the browser, in preference order. */
export function readableBookFormats(files: BookFile[]): ReadableBookFormat[] {
	const ready = new Set(readyFiles(files).map((file) => file.format));
	return READABLE_BOOK_FORMATS.filter((format) => ready.has(format));
}
