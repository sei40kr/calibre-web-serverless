import type { Bookshelf } from "../models/bookshelf";

export interface BookshelfRepository {
	getAll(userId: string): Promise<Bookshelf[]>;
	/** Live list of the user's bookshelves, sorted by name. */
	subscribeToBookshelves(
		userId: string,
		callbacks: {
			onData: (bookshelves: Bookshelf[]) => void;
			onError: (error: Error) => void;
		},
	): () => void;
	/**
	 * Create an empty bookshelf. Rejects with a `BookshelfError` when the name
	 * is blank/too long ("invalid-name") or already used ("duplicate-name").
	 */
	create(userId: string, name: string): Promise<Bookshelf>;
	/**
	 * Persist the user-editable fields of a bookshelf (currently the name; the
	 * denormalised `bookCount` is never written). Rejects with a
	 * `BookshelfError` when the name is blank/too long ("invalid-name"), used
	 * by another bookshelf ("duplicate-name"), or the bookshelf is gone
	 * ("bookshelf-not-found").
	 */
	update(userId: string, bookshelf: Bookshelf): Promise<void>;
	/**
	 * Remove the bookshelf and its membership from every book. Books are kept.
	 */
	delete(userId: string, bookshelfId: string): Promise<void>;
}
