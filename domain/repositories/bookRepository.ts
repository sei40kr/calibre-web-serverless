import type { Book } from "../models/book";
import type { BookFileFormat } from "../models/bookFile";
import type { BookFilter, BookSort } from "../models/bookQuery";

export interface BookRepository {
	hasBooks(userId: string): Promise<boolean>;
	getBook(userId: string, bookId: string): Promise<Book | null>;
	/**
	 * Live, server-filtered view of the user's books. `bookshelfId` restricts the
	 * result to one bookshelf's contents; it may not be combined with a filter that
	 * has an active array dimension (Firestore allows one array-membership
	 * clause per query).
	 */
	subscribeToBooks(
		userId: string,
		options: {
			bookshelfId?: string;
			filter?: BookFilter;
			sort?: BookSort;
			onData: (books: Book[]) => void;
			onError: (error: Error) => void;
		},
	): () => void;
	subscribeToBook(
		userId: string,
		bookId: string,
		callbacks: {
			onData: (book: Book) => void;
			onError: (error: Error) => void;
		},
	): () => void;
	/** Create a new book from its first uploaded file. */
	createBook(params: {
		userId: string;
		file: File;
	}): Promise<{ bookId: string; format: BookFileFormat }>;
	updateBook(userId: string, book: Book): Promise<void>;
	deleteBook(userId: string, bookId: string): Promise<void>;
}
