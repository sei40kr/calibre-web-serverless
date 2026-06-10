import type { Publisher } from "@calibre-web-serverless/domain/models/publisher";
import type { PublisherRepository } from "@calibre-web-serverless/domain/repositories/publisherRepository";
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

interface PublisherDocument {
	id: string;
	name: string;
	bookCount: number;
	createdAt: Timestamp | null;
	updatedAt: Timestamp | null;
}

const toPublisher = (doc: PublisherDocument): Publisher => ({
	id: doc.id,
	name: doc.name,
	createdAt: doc.createdAt?.toDate() ?? null,
	updatedAt: doc.updatedAt?.toDate() ?? null,
});

const getAll = async (userId: string): Promise<Publisher[]> => {
	const publishersRef = collection(db, "users", userId, "publishers");
	const q = query(publishersRef, orderBy("name", "asc"));
	const snapshot = await getDocs(q);

	return snapshot.docs.map((d) =>
		toPublisher({ id: d.id, ...d.data() } as PublisherDocument),
	);
};

const create = async (userId: string, name: string): Promise<Publisher> => {
	const publishersRef = collection(db, "users", userId, "publishers");

	const publisherData: Omit<
		PublisherDocument,
		"id" | "createdAt" | "updatedAt"
	> & {
		createdAt: FieldValue;
		updatedAt: FieldValue;
	} = {
		name,
		// bookCount is incremented by syncBookCounts in bookRepository when a book references this publisher
		bookCount: 0,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};

	const docRef = await addDoc(publishersRef, publisherData);

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
): Promise<Publisher> => {
	const publishersRef = collection(db, "users", userId, "publishers");
	const q = query(publishersRef, where("name", "==", name), limit(1));
	const snapshot = await getDocs(q);

	if (!snapshot.empty) {
		const d = snapshot.docs[0];
		return toPublisher({ id: d.id, ...d.data() } as PublisherDocument);
	}

	return create(userId, name);
};

export const publisherRepository: PublisherRepository = {
	getAll,
	create,
	findByNameOrCreate,
};
