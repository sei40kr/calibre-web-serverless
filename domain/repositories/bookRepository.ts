import type { Book } from "../models/book";
import type { BookFilter, BookSort } from "../models/bookQuery";

export interface BookRepository {
	hasBooks(userId: string): Promise<boolean>;
	getBook(userId: string, bookId: string): Promise<Book | null>;
	subscribeToBooks(
		userId: string,
		options: {
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
	getBookDownloadUrl(
		userId: string,
		bookId: string,
		format: string,
	): Promise<string>;
	uploadBook(params: {
		userId: string;
		file: File;
	}): Promise<{ bookId: string; format: string }>;
	updateBook(userId: string, book: Book): Promise<void>;
	deleteBook(userId: string, bookId: string): Promise<void>;
}
