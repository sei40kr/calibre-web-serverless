import type { Tag } from "@calibre-web-serverless/domain/models/tag";
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

interface TagDocument {
	id: string;
	name: string;
	bookCount: number;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

const toTag = (doc: TagDocument): Tag => ({
	id: doc.id,
	name: doc.name,
	createdAt: doc.createdAt.toDate(),
	updatedAt: doc.updatedAt.toDate(),
});

export const getTags = async (userId: string): Promise<Tag[]> => {
	const tagsRef = collection(db, "users", userId, "tags");
	const q = query(tagsRef, orderBy("name", "asc"));
	const snapshot = await getDocs(q);

	return snapshot.docs.map((d) =>
		toTag({ id: d.id, ...d.data() } as TagDocument),
	);
};

export const createTag = async (userId: string, name: string): Promise<Tag> => {
	const tagsRef = collection(db, "users", userId, "tags");

	const tagData: Omit<TagDocument, "id" | "createdAt" | "updatedAt"> & {
		createdAt: FieldValue;
		updatedAt: FieldValue;
	} = {
		name,
		// bookCount is incremented by syncBookCounts in bookService when a book references this tag
		bookCount: 0,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};

	const docRef = await addDoc(tagsRef, tagData);

	return {
		id: docRef.id,
		name,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
};
