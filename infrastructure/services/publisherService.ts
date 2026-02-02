import type { Publisher } from "@calibre-web-serverless/domain/models/publisher";
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

interface PublisherDocument {
	id: string;
	name: string;
	bookCount: number;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

const toPublisher = (doc: PublisherDocument): Publisher => ({
	id: doc.id,
	name: doc.name,
	createdAt: doc.createdAt.toDate(),
	updatedAt: doc.updatedAt.toDate(),
});

export const getPublishers = async (userId: string): Promise<Publisher[]> => {
	const publishersRef = collection(db, "users", userId, "publishers");
	const q = query(publishersRef, orderBy("name", "asc"));
	const snapshot = await getDocs(q);

	return snapshot.docs.map((d) =>
		toPublisher({ id: d.id, ...d.data() } as PublisherDocument),
	);
};

export const createPublisher = async (
	userId: string,
	name: string,
): Promise<Publisher> => {
	const publishersRef = collection(db, "users", userId, "publishers");

	const publisherData: Omit<
		PublisherDocument,
		"id" | "createdAt" | "updatedAt"
	> & {
		createdAt: FieldValue;
		updatedAt: FieldValue;
	} = {
		name,
		// bookCount is incremented by syncBookCounts in bookService when a book references this publisher
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
