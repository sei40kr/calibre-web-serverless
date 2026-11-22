import type { Book } from "../models/book";
import type { BookFileFormat } from "../models/bookFile";
import type { BookFilter, BookSort } from "../models/bookQuery";
import type { ReadingProgress } from "../models/readingProgress";

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
	/** Live view of the books being read, most recently read first. */
	subscribeToBooksInProgress(
		userId: string,
		options: {
			limit: number;
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
	/**
	 * Create a new book from its first uploaded file. `onProgress` reports the
	 * Storage transfer as it advances; it never fires after the returned
	 * promise settles.
	 */
	createBook(params: {
		userId: string;
		file: File;
		onProgress?: (bytesTransferred: number, totalBytes: number) => void;
	}): Promise<{ bookId: string; format: BookFileFormat }>;
	updateBook(userId: string, book: Book): Promise<void>;
	/**
	 * Replace the book's reading progress. `updateBook` never writes it, so a
	 * metadata save cannot rewind progress; this in turn leaves `updatedAt`
	 * alone, since reading is not a metadata edit.
	 */
	updateReadingProgress(
		userId: string,
		bookId: string,
		reading: ReadingProgress,
	): Promise<void>;
	deleteBook(userId: string, bookId: string): Promise<void>;
}
