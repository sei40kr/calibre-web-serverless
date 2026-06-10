import type { Series } from "@calibre-web-serverless/domain/models/series";
import type { SeriesRepository } from "@calibre-web-serverless/domain/repositories/seriesRepository";
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

interface SeriesDocument {
	id: string;
	name: string;
	bookCount: number;
	createdAt: Timestamp | null;
	updatedAt: Timestamp | null;
}

const toSeries = (doc: SeriesDocument): Series => ({
	id: doc.id,
	name: doc.name,
	createdAt: doc.createdAt?.toDate() ?? null,
	updatedAt: doc.updatedAt?.toDate() ?? null,
});

const getAll = async (userId: string): Promise<Series[]> => {
	const seriesRef = collection(db, "users", userId, "series");
	const q = query(seriesRef, orderBy("name", "asc"));
	const snapshot = await getDocs(q);

	return snapshot.docs.map((d) =>
		toSeries({ id: d.id, ...d.data() } as SeriesDocument),
	);
};

const create = async (userId: string, name: string): Promise<Series> => {
	const seriesRef = collection(db, "users", userId, "series");

	const seriesData: Omit<SeriesDocument, "id" | "createdAt" | "updatedAt"> & {
		createdAt: FieldValue;
		updatedAt: FieldValue;
	} = {
		name,
		// bookCount is incremented by syncBookCounts in bookRepository when a book references this series
		bookCount: 0,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};

	const docRef = await addDoc(seriesRef, seriesData);

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
): Promise<Series> => {
	const seriesRef = collection(db, "users", userId, "series");
	const q = query(seriesRef, where("name", "==", name), limit(1));
	const snapshot = await getDocs(q);

	if (!snapshot.empty) {
		const d = snapshot.docs[0];
		return toSeries({ id: d.id, ...d.data() } as SeriesDocument);
	}

	return create(userId, name);
};

export const seriesRepository: SeriesRepository = {
	getAll,
	create,
	findByNameOrCreate,
};
