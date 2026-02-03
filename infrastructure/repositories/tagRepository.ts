import type { Tag } from "@calibre-web-serverless/domain/models/tag";
import type { TagRepository } from "@calibre-web-serverless/domain/repositories/tagRepository";
import {
	addDoc,
	collection,
	type FieldValue,
	getDocs,
	limit,
	orderBy,
	query,
	serverTimestamp,
	type Timestamp,
	where,
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

const getAll = async (userId: string): Promise<Tag[]> => {
	const tagsRef = collection(db, "users", userId, "tags");
	const q = query(tagsRef, orderBy("name", "asc"));
	const snapshot = await getDocs(q);

	return snapshot.docs.map((d) =>
		toTag({ id: d.id, ...d.data() } as TagDocument),
	);
};

const create = async (userId: string, name: string): Promise<Tag> => {
	const tagsRef = collection(db, "users", userId, "tags");

	const tagData: Omit<TagDocument, "id" | "createdAt" | "updatedAt"> & {
		createdAt: FieldValue;
		updatedAt: FieldValue;
	} = {
		name,
		// bookCount is incremented by syncBookCounts in bookRepository when a book references this tag
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

const findByNameOrCreate = async (
	userId: string,
	name: string,
): Promise<Tag> => {
	const tagsRef = collection(db, "users", userId, "tags");
	const q = query(tagsRef, where("name", "==", name), limit(1));
	const snapshot = await getDocs(q);

	if (!snapshot.empty) {
		const d = snapshot.docs[0];
		return toTag({ id: d.id, ...d.data() } as TagDocument);
	}

	return create(userId, name);
};

export const tagRepository: TagRepository = {
	getAll,
	create,
	findByNameOrCreate,
};
