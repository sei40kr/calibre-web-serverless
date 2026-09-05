import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import { getFirestore, type Timestamp } from "firebase-admin/firestore";

interface BookshelfDocument {
	name: string;
	bookCount: number;
	createdAt: Timestamp | null;
	updatedAt: Timestamp | null;
}

const bookshelvesPath = (userId: string) => `users/${userId}/bookshelves`;

const toBookshelf = (id: string, d: BookshelfDocument): Bookshelf => ({
	id,
	name: d.name,
	bookCount: d.bookCount ?? 0,
	createdAt: d.createdAt?.toDate() ?? null,
	updatedAt: d.updatedAt?.toDate() ?? null,
});

/** Every bookshelf of a user, sorted by name (the order calibre-web's OPDS uses). */
const listBookshelves = async (userId: string): Promise<Bookshelf[]> => {
	const snapshot = await getFirestore()
		.collection(bookshelvesPath(userId))
		.orderBy("name", "asc")
		.get();
	return snapshot.docs.map((doc) =>
		toBookshelf(doc.id, doc.data() as BookshelfDocument),
	);
};

/** A single bookshelf scoped to the owning user, or null if it does not exist. */
const getBookshelf = async (
	userId: string,
	bookshelfId: string,
): Promise<Bookshelf | null> => {
	const doc = await getFirestore()
		.doc(`${bookshelvesPath(userId)}/${bookshelfId}`)
		.get();
	return doc.exists
		? toBookshelf(doc.id, doc.data() as BookshelfDocument)
		: null;
};

export const bookshelfRepository = {
	listBookshelves,
	getBookshelf,
};
