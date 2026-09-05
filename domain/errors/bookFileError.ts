export type BookFileErrorCode =
	| "unsupported-format"
	| "duplicate-format"
	| "book-not-found"
	| "book-not-ready"
	| "last-file";

/** Validation failure when adding or removing a single format of a book. */
export class BookFileError extends Error {
	constructor(
		public readonly code: BookFileErrorCode,
		message: string,
	) {
		super(message);
	}
}
