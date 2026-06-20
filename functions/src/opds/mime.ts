const BOOK_MIME_BY_FORMAT: Record<string, string> = {
	epub: "application/epub+zip",
	pdf: "application/pdf",
	mobi: "application/x-mobipocket-ebook",
	azw: "application/vnd.amazon.ebook",
	azw3: "application/vnd.amazon.ebook",
	cbz: "application/vnd.comicbook+zip",
	cbr: "application/vnd.comicbook-rar",
	fb2: "application/x-fictionbook+xml",
	txt: "text/plain",
};

/** MIME type for a book file format, falling back to a generic binary type. */
export function bookMimeType(format: string): string {
	return (
		BOOK_MIME_BY_FORMAT[format.toLowerCase()] ?? "application/octet-stream"
	);
}
