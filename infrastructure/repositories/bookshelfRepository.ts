import { BookshelfError } from "@calibre-web-serverless/domain/errors/bookshelfError";
import {
	type Bookshelf,
	bookshelfNameProblem,
	normalizeBookshelfName,
} from "@calibre-web-serverless/domain/models/bookshelf";
import type { BookshelfRepository } from "@calibre-web-serverless/domain/repositories/bookshelfRepository";
import {
	addDoc,
	arrayRemove,
	collection,
	doc,
	type FieldValue,
	getDocs,
	limit,
	onSnapshot,
	orderBy,
	query,
	runTransaction,
	serverTimestamp,
	type Timestamp,
	where,
	writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";

interface BookshelfDocument {
	name: string;
	/** Denormalised size, maintained transactionally alongside `Book.bookshelfIds`. */
	bookCount: number;
	createdAt: Timestamp | null;
	updatedAt: Timestamp | null;
}

const toBookshelf = (id: string, d: BookshelfDocument): Bookshelf => ({
	id,
	name: d.name,
	bookCount: d.bookCount ?? 0,
	createdAt: d.createdAt?.toDate() ?? null,
	updatedAt: d.updatedAt?.toDate() ?? null,
});

const bookshelvesRef = (userId: string) =>
	collection(db, "users", userId, "bookshelves");
const bookshelfRef = (userId: string, bookshelfId: string) =>
	doc(db, "users", userId, "bookshelves", bookshelfId);

// Firestore caps a write batch at 500 operations.
const BATCH_LIMIT = 500;

const getAll = async (userId: string): Promise<Bookshelf[]> => {
	const snapshot = await getDocs(
		query(bookshelvesRef(userId), orderBy("name", "asc")),
	);
	return snapshot.docs.map((d) =>
		toBookshelf(d.id, d.data() as BookshelfDocument),
	);
};

const subscribeToBookshelves = (
	userId: string,
	{
		onData,
		onError,
	}: {
		onData: (bookshelves: Bookshelf[]) => void;
		onError: (error: Error) => void;
	},
): (() => void) =>
	onSnapshot(
		query(bookshelvesRef(userId), orderBy("name", "asc")),
		(snapshot) => {
			onData(
				snapshot.docs.map((d) =>
					toBookshelf(d.id, d.data() as BookshelfDocument),
				),
			);
		},
		onError,
	);

const create = async (userId: string, rawName: string): Promise<Bookshelf> => {
	const problem = bookshelfNameProblem(rawName);
	if (problem) {
		throw new BookshelfError(
			"invalid-name",
			problem === "empty"
				? "Bookshelf name must not be empty"
				: "Bookshelf name is too long",
		);
	}
	const name = normalizeBookshelfName(rawName);

	// Like calibre-web, a user cannot own two bookshelves with the same name. The
	// check is not transactional (queries cannot run inside a client-side
	// transaction), which is acceptable for a single user creating bookshelves one
	// at a time.
	const existing = await getDocs(
		query(bookshelvesRef(userId), where("name", "==", name), limit(1)),
	);
	if (!existing.empty) {
		throw new BookshelfError(
			"duplicate-name",
			`A bookshelf named "${name}" already exists`,
		);
	}

	const data: Omit<BookshelfDocument, "createdAt" | "updatedAt"> & {
		createdAt: FieldValue;
		updatedAt: FieldValue;
	} = {
		name,
		bookCount: 0,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};
	const created = await addDoc(bookshelvesRef(userId), data);

	return {
		id: created.id,
		name,
		bookCount: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
};

const update = async (userId: string, bookshelf: Bookshelf): Promise<void> => {
	const rawName = bookshelf.name;
	const problem = bookshelfNameProblem(rawName);
	if (problem) {
		throw new BookshelfError(
			"invalid-name",
			problem === "empty"
				? "Bookshelf name must not be empty"
				: "Bookshelf name is too long",
		);
	}
	const name = normalizeBookshelfName(rawName);

	// Same non-transactional uniqueness check as `create`; the updated
	// bookshelf itself is allowed to keep its current name.
	const existing = await getDocs(
		query(bookshelvesRef(userId), where("name", "==", name), limit(1)),
	);
	if (!existing.empty && existing.docs[0].id !== bookshelf.id) {
		throw new BookshelfError(
			"duplicate-name",
			`A bookshelf named "${name}" already exists`,
		);
	}

	// Only the name is user-editable; `bookCount` is denormalised state owned
	// by the membership service and must never be written back from a model.
	await runTransaction(db, async (transaction) => {
		const snapshot = await transaction.get(bookshelfRef(userId, bookshelf.id));
		if (!snapshot.exists()) {
			throw new BookshelfError("bookshelf-not-found", "Bookshelf not found");
		}
		transaction.update(snapshot.ref, { name, updatedAt: serverTimestamp() });
	});
};

const deleteBookshelf = async (
	userId: string,
	bookshelfId: string,
): Promise<void> => {
	// Strip the membership from every book first, then drop the bookshelf. Should
	// the process die midway, a leftover bookshelf id on a book is harmless: the UI
	// and queries only ever resolve ids against existing bookshelves.
	const members = await getDocs(
		query(
			collection(db, "users", userId, "books"),
			where("bookshelfIds", "array-contains", bookshelfId),
		),
	);
	for (let i = 0; i < members.docs.length; i += BATCH_LIMIT) {
		const batch = writeBatch(db);
		for (const member of members.docs.slice(i, i + BATCH_LIMIT)) {
			batch.update(member.ref, { bookshelfIds: arrayRemove(bookshelfId) });
		}
		await batch.commit();
	}

	const batch = writeBatch(db);
	batch.delete(bookshelfRef(userId, bookshelfId));
	await batch.commit();
};

export const bookshelfRepository: BookshelfRepository = {
	getAll,
	subscribeToBookshelves,
	create,
	update,
	delete: deleteBookshelf,
};
