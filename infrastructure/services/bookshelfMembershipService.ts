import { BookshelfError } from "@calibre-web-serverless/domain/errors/bookshelfError";
import {
	arrayRemove,
	arrayUnion,
	doc,
	runTransaction,
	serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const bookshelfRef = (userId: string, bookshelfId: string) =>
	doc(db, "users", userId, "bookshelves", bookshelfId);
const bookRef = (userId: string, bookId: string) =>
	doc(db, "users", userId, "books", bookId);

/**
 * Atomically flips a book's membership in a bookshelf and adjusts the
 * bookshelf's `bookCount` by the same amount, so the count can never drift
 * from the membership even under concurrent edits or repeated calls.
 *
 * This spans two aggregates (the book and the bookshelf), which is why it
 * lives in a service instead of either repository.
 */
const setMembership = async (
	userId: string,
	bookshelfId: string,
	bookId: string,
	member: boolean,
): Promise<void> => {
	await runTransaction(db, async (transaction) => {
		const [bookshelfSnapshot, bookSnapshot] = await Promise.all([
			transaction.get(bookshelfRef(userId, bookshelfId)),
			transaction.get(bookRef(userId, bookId)),
		]);
		if (!bookSnapshot.exists()) {
			throw new BookshelfError("book-not-found", "Book not found");
		}
		const bookshelf = bookshelfSnapshot.data() as
			| { bookCount?: number }
			| undefined;
		// A book can reference a bookshelf lost to an interrupted delete, so
		// only adding requires the bookshelf to exist — removing such a stale
		// membership must still succeed (with no count left to maintain).
		if (!bookshelf && member) {
			throw new BookshelfError("bookshelf-not-found", "Bookshelf not found");
		}

		const bookshelfIds: string[] = bookSnapshot.data()?.bookshelfIds ?? [];
		if (bookshelfIds.includes(bookshelfId) === member) {
			return;
		}

		transaction.update(bookSnapshot.ref, {
			bookshelfIds: member ? arrayUnion(bookshelfId) : arrayRemove(bookshelfId),
		});
		if (bookshelf) {
			transaction.update(bookshelfSnapshot.ref, {
				bookCount: Math.max(0, (bookshelf.bookCount ?? 0) + (member ? 1 : -1)),
				updatedAt: serverTimestamp(),
			});
		}
	});
};

export const bookshelfMembershipService = {
	/** Add a book to a bookshelf. A no-op when it is already there. */
	addBook: (userId: string, bookshelfId: string, bookId: string) =>
		setMembership(userId, bookshelfId, bookId, true),
	/** Remove a book from a bookshelf. A no-op when it is not there. */
	removeBook: (userId: string, bookshelfId: string, bookId: string) =>
		setMembership(userId, bookshelfId, bookId, false),
};
