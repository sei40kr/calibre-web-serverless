export type BookshelfErrorCode =
	| "invalid-name"
	| "duplicate-name"
	| "bookshelf-not-found"
	| "book-not-found";

/** Validation failure when creating a bookshelf or changing its membership. */
export class BookshelfError extends Error {
	constructor(
		public readonly code: BookshelfErrorCode,
		message: string,
	) {
		super(message);
	}
}
