import type { Author } from "@calibre-web-serverless/domain/models/author";
import {
	addDoc,
	collection,
	type FieldValue,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	type Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

interface AuthorDocument {
	id: string;
	name: string;
	sortName: string | null;
	bookCount: number;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

const toAuthor = (doc: AuthorDocument): Author => ({
	id: doc.id,
	name: doc.name,
	sortName: doc.sortName,
	createdAt: doc.createdAt.toDate(),
	updatedAt: doc.updatedAt.toDate(),
});

export const getAuthors = async (userId: string): Promise<Author[]> => {
	const authorsRef = collection(db, "users", userId, "authors");
	const q = query(authorsRef, orderBy("name", "asc"));
	const snapshot = await getDocs(q);

	return snapshot.docs.map((d) =>
		toAuthor({ id: d.id, ...d.data() } as AuthorDocument),
	);
};

export const createAuthor = async (
	userId: string,
	name: string,
): Promise<Author> => {
	const authorsRef = collection(db, "users", userId, "authors");

	const authorData: Omit<AuthorDocument, "id" | "createdAt" | "updatedAt"> & {
		createdAt: FieldValue;
		updatedAt: FieldValue;
	} = {
		name,
		sortName: null,
		// bookCount is incremented by syncBookCounts in bookService when a book references this author
		bookCount: 0,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};

	const docRef = await addDoc(authorsRef, authorData);

	return {
		id: docRef.id,
		name,
		sortName: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
};
